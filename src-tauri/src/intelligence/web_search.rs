use std::{collections::HashSet, sync::LazyLock, time::Duration};

use reqwest::{Client, Url};
use serde::Deserialize;
use serde_json::json;

use crate::llm::provider::{StreamSource, WebSearchStatus};

const ENDPOINT: &str = "https://api.tavily.com/search";
const REQUEST_TIMEOUT: Duration = Duration::from_millis(2500);
const MAX_RESULTS: usize = 3;
const MAX_QUERY_CHARS: usize = 400;

static CLIENT: LazyLock<Result<Client, reqwest::Error>> = LazyLock::new(|| {
    Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(REQUEST_TIMEOUT)
        .build()
});

#[derive(Deserialize)]
struct SearchResponse {
    results: Vec<SearchHit>,
}

#[derive(Deserialize)]
pub struct SearchHit {
    title: String,
    url: String,
    content: String,
}

impl SearchHit {
    pub fn source(&self) -> StreamSource {
        StreamSource {
            title: self.title.clone(),
            url: self.url.clone(),
        }
    }
}

#[derive(Debug)]
pub struct SearchError {
    pub status: WebSearchStatus,
    pub message: String,
}

impl From<reqwest::Error> for SearchError {
    fn from(error: reqwest::Error) -> Self {
        let (status, message) = if error.is_timeout() {
            (WebSearchStatus::Timeout, "网页搜索超时，请检查网络连接。".to_string())
        } else if let Some(code) = error.status() {
            let message = match code.as_u16() {
                401 | 403 => "Tavily 拒绝访问，请检查 API Key 和账号权限。".to_string(),
                429 | 432 | 433 => "Tavily 达到频率或额度限制。".to_string(),
                _ => format!("Tavily 搜索请求失败（HTTP {}）。", code.as_u16()),
            };
            (WebSearchStatus::Error, message)
        } else {
            (WebSearchStatus::Error, "无法完成 Tavily 搜索，请检查网络连接后重试。".to_string())
        };
        Self { status, message }
    }
}

pub async fn search(key: &str, question: &str) -> Result<Vec<SearchHit>, SearchError> {
    let client = CLIENT.as_ref().map_err(|_| SearchError {
        status: WebSearchStatus::Error,
        message: "网页搜索客户端初始化失败。".to_string(),
    })?;
    search_at(client, ENDPOINT, key, question).await
}

async fn search_at(client: &Client, endpoint: &str, key: &str, question: &str) -> Result<Vec<SearchHit>, SearchError> {
    let query: String = question.trim().chars().take(MAX_QUERY_CHARS).collect();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let response = client
        .post(endpoint)
        .bearer_auth(key)
        .json(&json!({
            "query": query,
            "search_depth": "basic",
            "max_results": MAX_RESULTS,
            "include_answer": false,
            "include_raw_content": false,
        }))
        .send()
        .await?
        .error_for_status()?
        .json::<SearchResponse>()
        .await?;
    let mut seen = HashSet::new();
    Ok(response.results.into_iter().filter_map(|hit| {
        let mut url = Url::parse(&hit.url).ok()?;
        if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none()
            || !url.username().is_empty() || url.password().is_some() || hit.content.trim().is_empty()
        {
            return None;
        }
        url.set_fragment(None);
        let url = url.to_string();
        if !seen.insert(url.clone()) {
            return None;
        }
        Some(SearchHit {
            title: hit.title.trim().chars().take(160).collect(),
            url,
            content: hit.content.trim().chars().take(1200).collect(),
        })
    }).take(MAX_RESULTS).collect())
}

pub fn reference_text(results: &[SearchHit]) -> String {
    results.iter().enumerate().map(|(index, hit)| {
        format!("[Web {}] {}\n{}\n{}", index + 1, hit.title, hit.url, hit.content)
    }).collect::<Vec<_>>().join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};

    #[tokio::test]
    async fn tavily_sends_only_question_and_filters_response_sources() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint = format!("http://{}/search", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            let (connection, _) = listener.accept().await.unwrap();
            let mut connection = BufReader::new(connection);
            let mut headers = String::new();
            loop {
                let mut line = String::new();
                assert_ne!(connection.read_line(&mut line).await.unwrap(), 0);
                headers.push_str(&line);
                if line == "\r\n" {
                    break;
                }
            }
            assert!(headers.starts_with("POST /search HTTP/1.1"));
            let headers = headers.to_ascii_lowercase();
            assert!(headers.contains("authorization: bearer test-key\r\n"));
            let content_length: usize = headers.lines().find_map(|line| {
                line.strip_prefix("content-length:").map(|value| value.trim().parse().unwrap())
            }).unwrap();
            let mut body = vec![0; content_length];
            connection.read_exact(&mut body).await.unwrap();
            assert_eq!(serde_json::from_slice::<serde_json::Value>(&body).unwrap(), json!({
                "query": "What did Example Inc announce?",
                "search_depth": "basic",
                "max_results": 3,
                "include_answer": false,
                "include_raw_content": false,
            }));
            let body = json!({ "results": [
                { "title": "Announcement", "url": "https://example.com/news#start", "content": "An example fact." },
                { "title": "Duplicate", "url": "https://example.com/news", "content": "Duplicate text." },
                { "title": "Invalid", "url": "file:///private.txt", "content": "Discard this." }
            ] }).to_string();
            connection.write_all(format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(), body
            ).as_bytes()).await.unwrap();
        });
        let results = search_at(CLIENT.as_ref().unwrap(), &endpoint, "test-key", " What did Example Inc announce? ")
            .await.unwrap();
        server.await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].source().url, "https://example.com/news");
        assert_eq!(reference_text(&results), "[Web 1] Announcement\nhttps://example.com/news\nAn example fact.");
    }
}
