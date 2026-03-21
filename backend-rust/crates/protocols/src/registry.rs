use super::types::ProtocolAdapter;
use defi10_core::Chain;
use std::sync::Arc;

pub struct ProtocolRegistry {
    adapters: Vec<Arc<dyn ProtocolAdapter>>,
}

impl ProtocolRegistry {
    pub fn new() -> Self {
        Self {
            adapters: Vec::new(),
        }
    }

    pub fn register(&mut self, adapter: Arc<dyn ProtocolAdapter>) {
        self.adapters.push(adapter);
    }

    pub fn get_for_chain(&self, chain: Chain) -> Vec<Arc<dyn ProtocolAdapter>> {
        self.adapters
            .iter()
            .filter(|a| a.supported_chains().contains(&chain))
            .cloned()
            .collect()
    }

    pub fn get_by_name(&self, name: &str) -> Option<Arc<dyn ProtocolAdapter>> {
        self.adapters.iter().find(|a| a.name() == name).cloned()
    }

    pub fn all(&self) -> &[Arc<dyn ProtocolAdapter>] {
        &self.adapters
    }
}

impl Default for ProtocolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
