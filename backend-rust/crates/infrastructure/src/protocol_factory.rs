use crate::config::AppConfig;
use defi10_protocols::aave::AaveGraphConfig;
use defi10_protocols::uniswap::UniswapGraphConfig;

pub fn build_aave_config(config: &AppConfig) -> AaveGraphConfig {
    config
        .graph
        .as_ref()
        .map(|g| AaveGraphConfig {
            api_key: Some(g.api_key.clone()),
            url_template: Some(g.url_template.clone()),
            base_subgraph_id: g.subgraphs.aave_v3_base.clone(),
            ethereum_subgraph_id: g.subgraphs.aave_v3_ethereum.clone(),
            arbitrum_subgraph_id: g.subgraphs.aave_v3_arbitrum.clone(),
        })
        .unwrap_or_default()
}

pub fn build_uniswap_config(config: &AppConfig) -> UniswapGraphConfig {
    config
        .graph
        .as_ref()
        .map(|g| UniswapGraphConfig {
            api_key: Some(g.api_key.clone()),
            url_template: Some(g.url_template.clone()),
            ethereum_subgraph_id: g.subgraphs.uniswap_v3_ethereum.clone(),
            base_subgraph_id: g.subgraphs.uniswap_v3_base.clone(),
            arbitrum_subgraph_id: g.subgraphs.uniswap_v3_arbitrum.clone(),
            ethereum_rpc: config.blockchain.get_ethereum_rpc(),
            base_rpc: config.blockchain.get_base_rpc(),
            arbitrum_rpc: config.blockchain.get_arbitrum_rpc(),
        })
        .unwrap_or_default()
}
