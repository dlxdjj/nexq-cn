use serde::{Deserialize, Serialize};

/// RAG pipeline configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RagConfig {
    /// Whether the RAG pipeline is enabled.
    pub enabled: bool,
    /// Ollama embedding model name.
    pub embedding_model: String,
    /// Ollama server base URL.
    pub ollama_url: String,
    /// Number of texts to embed per batch request.
    pub batch_size: usize,
    /// Target chunk size in tokens.
    pub chunk_size: usize,
    /// Overlap between consecutive chunks in tokens.
    pub chunk_overlap: usize,
    /// Text splitting strategy ("recursive", etc.).
    pub splitting_strategy: String,
    /// Number of top results to return from search.
    pub top_k: usize,
    /// Search mode: "hybrid", "semantic", or "keyword".
    pub search_mode: String,
    /// Minimum similarity score to include in results.
    pub similarity_threshold: f32,
    /// Weight for semantic search in hybrid mode (0.0–1.0).
    pub semantic_weight: f32,
    /// Whether to index live transcript segments.
    pub include_transcript: bool,
    /// Dimensionality of the embedding vectors.
    pub embedding_dimensions: usize,
}

impl RagConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.embedding_model.trim().is_empty() || self.embedding_dimensions == 0 || self.embedding_dimensions > 8192 {
            return Err("嵌入模型名称或维度无效".into());
        }
        let url = reqwest::Url::parse(&self.ollama_url).map_err(|_| "Ollama 地址无效".to_string())?;
        if !["http", "https"].contains(&url.scheme()) || url.host_str().is_none() { return Err("Ollama 地址必须为 HTTP 或 HTTPS 地址".into()); }
        if self.batch_size == 0 || self.batch_size > 256 || self.chunk_size == 0 || self.chunk_size > 8192 || self.chunk_overlap >= self.chunk_size {
            return Err("知识库分块或批量大小无效：重叠长度必须小于分块长度".into());
        }
        if self.top_k == 0 || self.top_k > 100 || !["hybrid", "semantic", "keyword"].contains(&self.search_mode.as_str()) {
            return Err("知识库检索参数无效".into());
        }
        if !(0.0..=1.0).contains(&self.similarity_threshold) || !(0.0..=1.0).contains(&self.semantic_weight) {
            return Err("相似度和语义权重必须在 0 到 1 之间".into());
        }
        Ok(())
    }
}

impl Default for RagConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            embedding_model: "nomic-embed-text".to_string(),
            ollama_url: "http://localhost:11434".to_string(),
            batch_size: 32,
            chunk_size: 512,
            chunk_overlap: 64,
            splitting_strategy: "recursive".to_string(),
            top_k: 5,
            search_mode: "hybrid".to_string(),
            similarity_threshold: 0.3,
            semantic_weight: 0.7,
            include_transcript: true,
            embedding_dimensions: 768,
        }
    }
}
