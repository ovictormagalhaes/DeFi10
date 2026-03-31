import type { Protocol } from '../types/wallet';

export interface ProtocolConfig {
  id: string;
  name: string;
  logo: string;
  url: string;
}

const AAVE_V3: ProtocolConfig = {
  id: 'aave-v3',
  name: 'Aave V3',
  logo: '/resources/protocols/aave.svg',
  url: 'https://app.aave.com',
};

const UNISWAP_V3: ProtocolConfig = {
  id: 'uniswap-v3',
  name: 'Uniswap V3',
  logo: '/resources/protocols/uniswap.svg',
  url: 'https://app.uniswap.org',
};

const PENDLE_V2: ProtocolConfig = {
  id: 'pendle-v2',
  name: 'Pendle V2',
  logo: '/resources/protocols/pendle.svg',
  url: 'https://app.pendle.finance',
};

const PROTOCOL_MAP: Record<string, ProtocolConfig> = {
  'aave v3': AAVE_V3,
  'aave-v3': AAVE_V3,
  'uniswap v3': UNISWAP_V3,
  'uniswap-v3': UNISWAP_V3,
  kamino: {
    id: 'kamino',
    name: 'Kamino',
    logo: '/resources/protocols/kamino.svg',
    url: 'https://app.kamino.finance',
  },
  raydium: {
    id: 'raydium',
    name: 'Raydium',
    logo: '/resources/protocols/raydium.svg',
    url: 'https://raydium.io',
  },
  'pendle v2': PENDLE_V2,
  'pendle-v2': PENDLE_V2,
  wallet: {
    id: 'moralis',
    name: 'Wallet',
    logo: '',
    url: 'https://moralis.io',
  },
};

export function getProtocolConfig(name: string): ProtocolConfig {
  const key = name?.toLowerCase() ?? '';
  return (
    PROTOCOL_MAP[key] ?? {
      id: key.replace(/\s+/g, '-'),
      name,
      logo: '',
      url: '',
    }
  );
}

export function hydrateProtocol(partial: { name: string; chain: string }): Protocol {
  const config = getProtocolConfig(partial.name);
  return {
    name: config.name || partial.name,
    chain: partial.chain,
    id: config.id,
    logo: config.logo,
    url: config.url,
  };
}
