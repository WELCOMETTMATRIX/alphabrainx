// Browser-safe chain registry shared by server fns and UI.
// DexScreener chainId -> { label, GeckoTerminal network slug, explorer }

export type ChainMeta = {
  id: string;
  label: string;
  gt: string;
  explorer?: string;
  native?: string;
};

export const CHAINS: ChainMeta[] = [
  { id: "ethereum", label: "Ethereum", gt: "eth", explorer: "https://etherscan.io", native: "ETH" },
  { id: "bsc", label: "BNB Chain", gt: "bsc", explorer: "https://bscscan.com", native: "BNB" },
  { id: "solana", label: "Solana", gt: "solana", explorer: "https://solscan.io", native: "SOL" },
  { id: "base", label: "Base", gt: "base", explorer: "https://basescan.org", native: "ETH" },
  { id: "arbitrum", label: "Arbitrum", gt: "arbitrum", explorer: "https://arbiscan.io", native: "ETH" },
  { id: "polygon", label: "Polygon", gt: "polygon_pos", explorer: "https://polygonscan.com", native: "POL" },
  { id: "cronos", label: "Cronos", gt: "cronos", explorer: "https://cronoscan.com", native: "CRO" },
  { id: "avalanche", label: "Avalanche", gt: "avax", explorer: "https://snowtrace.io", native: "AVAX" },
  { id: "optimism", label: "Optimism", gt: "optimism", explorer: "https://optimistic.etherscan.io", native: "ETH" },
  { id: "sui", label: "Sui", gt: "sui-network", explorer: "https://suiscan.xyz", native: "SUI" },
  { id: "ton", label: "TON", gt: "ton", explorer: "https://tonviewer.com", native: "TON" },
  { id: "linea", label: "Linea", gt: "linea", explorer: "https://lineascan.build", native: "ETH" },
  { id: "scroll", label: "Scroll", gt: "scroll", explorer: "https://scrollscan.com", native: "ETH" },
  { id: "blast", label: "Blast", gt: "blast", explorer: "https://blastscan.io", native: "ETH" },
  { id: "mantle", label: "Mantle", gt: "mantle", explorer: "https://mantlescan.xyz", native: "MNT" },
  { id: "zksync", label: "zkSync Era", gt: "zksync", explorer: "https://explorer.zksync.io", native: "ETH" },
  { id: "fantom", label: "Fantom", gt: "ftm", explorer: "https://ftmscan.com", native: "FTM" },
  { id: "pulsechain", label: "PulseChain", gt: "pulsechain", explorer: "https://scan.pulsechain.com", native: "PLS" },
  { id: "celo", label: "Celo", gt: "celo", explorer: "https://celoscan.io", native: "CELO" },
  { id: "hyperliquid", label: "Hyperliquid", gt: "hyperliquid", native: "HYPE" },
  { id: "berachain", label: "Berachain", gt: "berachain", explorer: "https://berascan.com", native: "BERA" },
  { id: "sonic", label: "Sonic", gt: "sonic", explorer: "https://sonicscan.org", native: "S" },
  { id: "abstract", label: "Abstract", gt: "abstract", native: "ETH" },
  { id: "unichain", label: "Unichain", gt: "unichain", explorer: "https://uniscan.xyz", native: "ETH" },
  { id: "ronin", label: "Ronin", gt: "ronin", explorer: "https://app.roninchain.com", native: "RON" },
  { id: "kava", label: "Kava", gt: "kava", explorer: "https://kavascan.com", native: "KAVA" },
  { id: "metis", label: "Metis", gt: "metis", explorer: "https://explorer.metis.io", native: "METIS" },
  { id: "moonbeam", label: "Moonbeam", gt: "moonbeam", explorer: "https://moonscan.io", native: "GLMR" },
  { id: "cardano", label: "Cardano", gt: "cardano", explorer: "https://cardanoscan.io", native: "ADA" },
  { id: "tron", label: "Tron", gt: "tron", explorer: "https://tronscan.org", native: "TRX" },
  { id: "aptos", label: "Aptos", gt: "aptos", explorer: "https://explorer.aptoslabs.com", native: "APT" },
  { id: "starknet", label: "Starknet", gt: "starknet-alpha", explorer: "https://starkscan.co", native: "ETH" },
  { id: "near", label: "NEAR", gt: "near", explorer: "https://nearblocks.io", native: "NEAR" },
  { id: "osmosis", label: "Osmosis", gt: "osmosis", native: "OSMO" },
  { id: "injective", label: "Injective", gt: "injective", native: "INJ" },
  { id: "sei", label: "Sei", gt: "sei-evm", explorer: "https://seitrace.com", native: "SEI" },
  { id: "gnosis", label: "Gnosis", gt: "xdai", explorer: "https://gnosisscan.io", native: "xDAI" },
  { id: "core", label: "Core", gt: "core", explorer: "https://scan.coredao.org", native: "CORE" },
  { id: "zora", label: "Zora", gt: "zora-network", explorer: "https://explorer.zora.energy", native: "ETH" },
  { id: "world-chain", label: "World Chain", gt: "world-chain", native: "ETH" },
  { id: "apechain", label: "ApeChain", gt: "apechain", native: "APE" },
  { id: "taiko", label: "Taiko", gt: "taiko", explorer: "https://taikoscan.io", native: "ETH" },
  { id: "mode", label: "Mode", gt: "mode", explorer: "https://explorer.mode.network", native: "ETH" },
  { id: "manta", label: "Manta", gt: "manta-pacific", native: "ETH" },
  { id: "opbnb", label: "opBNB", gt: "opbnb", explorer: "https://opbnbscan.com", native: "BNB" },
  { id: "flare", label: "Flare", gt: "flare", explorer: "https://flarescan.com", native: "FLR" },
  { id: "filecoin", label: "Filecoin", gt: "filecoin", native: "FIL" },
  { id: "rootstock", label: "Rootstock", gt: "rootstock", native: "RBTC" },
];

export const CHAIN_BY_ID: Record<string, ChainMeta> = Object.fromEntries(
  CHAINS.map((c) => [c.id, c]),
);

export function chainLabel(id: string): string {
  return CHAIN_BY_ID[id]?.label ?? id;
}

export function gtNetwork(id: string): string {
  return CHAIN_BY_ID[id]?.gt ?? id;
}

export function explorerTokenUrl(chain: string, address: string): string | undefined {
  const meta = CHAIN_BY_ID[chain];
  if (!meta?.explorer) return undefined;
  if (chain === "solana") return `${meta.explorer}/token/${address}`;
  if (chain === "tron") return `${meta.explorer}/#/token20/${address}`;
  return `${meta.explorer}/token/${address}`;
}
