use rusqlite::{Connection, OptionalExtension};
use super::config::RagConfig;

const SETTINGS_KEY: &str = "rag_config_v1";
const INDEX_KEY: &str = "rag_index_profile_v1";

pub fn load(conn: &Connection) -> Result<RagConfig, String> {
    let saved: Option<String> = conn.query_row("SELECT value FROM app_state WHERE key=?1", [SETTINGS_KEY], |row| row.get(0))
        .optional().map_err(|e| e.to_string())?;
    match saved {
        None => Ok(RagConfig::default()),
        Some(value) => {
            let config: RagConfig = serde_json::from_str(&value).map_err(|e| format!("读取知识库设置失败: {e}"))?;
            config.validate()?;
            Ok(config)
        }
    }
}

pub fn save(conn: &Connection, config: &RagConfig) -> Result<(), String> {
    config.validate()?;
    let value = serde_json::to_string(config).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO app_state(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [SETTINGS_KEY, &value])
        .map_err(|e| format!("保存知识库设置失败: {e}"))?;
    Ok(())
}

pub fn profile(config: &RagConfig) -> String {
    serde_json::json!([config.embedding_model, config.ollama_url.trim_end_matches('/'), config.embedding_dimensions,
        config.chunk_size, config.chunk_overlap, config.splitting_strategy]).to_string()
}

pub fn verify_index(conn: &Connection, config: &RagConfig) -> Result<(), String> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM rag_chunks", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if count == 0 { return Ok(()); }
    let saved: Option<String> = conn.query_row("SELECT value FROM app_state WHERE key=?1", [INDEX_KEY], |r| r.get(0))
        .optional().map_err(|e| e.to_string())?;
    if saved.as_deref() != Some(profile(config).as_str()) {
        return Err("知识库索引与当前设置不一致，请重新构建知识库（资料文件会保留）".into());
    }
    Ok(())
}

pub fn record_index(conn: &Connection, config: &RagConfig) -> Result<(), String> {
    conn.execute("INSERT INTO app_state(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [INDEX_KEY, &profile(config)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Publish a fully built staging index in one transaction, including FTS.
pub fn publish_index(conn: &Connection, staging: &Connection, config: &RagConfig) -> Result<(), String> {
    use crate::db::rag as db;
    verify_index(staging, config)?;
    let mut stmt = staging.prepare("SELECT chunk_id,file_id,chunk_index,text,token_count,source_type FROM rag_chunks").map_err(|e| e.to_string())?;
    let chunks = stmt.query_map([], |row| Ok(db::ChunkRecord {
        chunk_id: row.get(0)?, file_id: row.get(1)?, chunk_index: row.get(2)?, text: row.get(3)?, token_count: row.get(4)?, source_type: row.get(5)?,
    })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    let embeddings = db::get_all_embeddings(staging)?;
    if chunks.len() != embeddings.len() { return Err("临时索引不完整，原索引已保留".into()); }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    db::clear_all_chunks(&tx)?;
    db::insert_chunks_in_transaction(&tx, &chunks)?;
    for (id, bytes) in embeddings { db::store_embedding(&tx, &id, &bytes)?; }
    tx.execute("UPDATE context_resources SET index_status='none'", []).map_err(|e| e.to_string())?;
    for chunk in &chunks { db::update_index_status(&tx, &chunk.file_id, "indexed")?; }
    record_index(&tx, config)?;
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE rag_chunks(text TEXT);").unwrap();
        conn
    }
    #[test]
    fn saved_settings_reload_instead_of_defaults() {
        let conn = db();
        let mut config = RagConfig::default();
        config.embedding_model = "mxbai-embed-large".into(); config.embedding_dimensions = 1024; config.top_k = 8;
        save(&conn, &config).unwrap();
        assert_eq!(serde_json::to_value(load(&conn).unwrap()).unwrap(), serde_json::to_value(config).unwrap());
    }
    #[test]
    fn invalid_settings_do_not_replace_valid_ones() {
        let conn = db(); let mut config = RagConfig::default();
        save(&conn, &config).unwrap(); config.batch_size = 0;
        assert!(save(&conn, &config).is_err()); assert_eq!(load(&conn).unwrap().batch_size, 32);
    }
    #[test]
    fn failed_publish_preserves_old_chunks_vectors_and_fts() {
        use crate::db::{DatabaseManager, rag as db};
        let live = DatabaseManager::in_memory().unwrap(); let staging = DatabaseManager::in_memory().unwrap();
        let config = RagConfig::default();
        for (conn, id, text) in [(live.connection(), "old", "previous reference"), (staging.connection(), "new", "new reference")] {
            db::insert_chunks_batch(conn, &[db::ChunkRecord { chunk_id: id.into(), file_id: "file".into(), chunk_index: 0, text: text.into(), token_count: 2, source_type: "file".into() }]).unwrap();
            db::store_embedding(conn, id, &[0; 4]).unwrap(); record_index(conn, &config).unwrap();
        }
        live.connection().execute_batch("CREATE TRIGGER fail_new BEFORE INSERT ON rag_chunks WHEN new.chunk_id='new' BEGIN SELECT RAISE(ABORT,'synthetic SQL failure'); END;").unwrap();
        assert!(publish_index(live.connection(), staging.connection(), &config).is_err());
        assert_eq!(db::get_all_embeddings(live.connection()).unwrap()[0].0, "old");
        let matches: i64 = live.connection().query_row("SELECT COUNT(*) FROM rag_fts WHERE rag_fts MATCH 'previous'", [], |r| r.get(0)).unwrap();
        assert_eq!(matches, 1);
        live.connection().execute_batch("DROP TRIGGER fail_new").unwrap();
        publish_index(live.connection(), staging.connection(), &config).unwrap();
        assert_eq!(db::get_all_embeddings(live.connection()).unwrap()[0].0, "new");
    }
    #[test]
    fn index_profile_survives_configuration_reload_and_rejects_model_change() {
        let conn = db(); let mut config = RagConfig::default();
        assert!(verify_index(&conn, &config).is_ok());
        conn.execute("INSERT INTO rag_chunks VALUES ('sample')", []).unwrap();
        assert!(verify_index(&conn, &config).is_err());
        record_index(&conn, &config).unwrap(); save(&conn, &config).unwrap();
        assert!(verify_index(&conn, &load(&conn).unwrap()).is_ok());
        config.top_k = 9; assert!(verify_index(&conn, &config).is_ok());
        config.embedding_model = "all-minilm".into(); assert!(verify_index(&conn, &config).is_err());
    }
}
