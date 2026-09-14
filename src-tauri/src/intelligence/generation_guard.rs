use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

/// Release the generation slot on every exit path, including preparation errors.
pub struct GenerationGuard(Arc<AtomicBool>);

impl GenerationGuard {
    pub fn acquire(flag: Arc<AtomicBool>) -> Result<Self, String> {
        flag.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "Generation already in progress".to_string())?;
        Ok(Self(flag))
    }
}

impl Drop for GenerationGuard {
    fn drop(&mut self) { self.0.store(false, Ordering::SeqCst); }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_preparation_releases_slot() {
        let flag = Arc::new(AtomicBool::new(false));
        let prepare = || -> Result<(), String> {
            let _guard = GenerationGuard::acquire(flag.clone())?;
            Err("No active model selected".into())
        };
        assert!(prepare().is_err());
        assert!(!flag.load(Ordering::SeqCst));
        assert!(GenerationGuard::acquire(flag).is_ok());
    }

    #[test]
    fn rejects_concurrent_request_without_releasing_owner() {
        let flag = Arc::new(AtomicBool::new(false));
        let owner = GenerationGuard::acquire(flag.clone()).unwrap();
        assert!(GenerationGuard::acquire(flag.clone()).is_err());
        assert!(flag.load(Ordering::SeqCst));
        drop(owner);
        assert!(!flag.load(Ordering::SeqCst));
    }
}
