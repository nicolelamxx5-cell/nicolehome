export const OPTION_STATUS_LABEL: Record<string, string> = {
  wishlist: "Wishlist",
  shortlisted: "Shortlisted",
  pending_confirmation: "Pending confirmation",
  approved: "Approved",
  ordered: "Ordered",
  cancelled: "Cancelled / replaced",
};

export const SOURCING_LABEL: Record<string, string> = {
  china: "China preferred",
  singapore: "Singapore preferred",
  compare: "Compare both",
  undecided: "Undecided",
};

export const PRICE_BASIS_LABEL: Record<string, string> = {
  observed: "Seen online — not a quote",
  estimate: "Estimate",
  quoted: "Supplier quotation",
  confirmed: "Confirmed final price",
};

export const PLATFORM_LABEL: Record<string, string> = {
  taobao: "Taobao",
  pinduoduo: "Pinduoduo",
  "1688": "1688",
  xiaohongshu: "Xiaohongshu",
  showroom: "Showroom",
  wechat: "WeChat",
  singapore_store: "Singapore store",
  website: "Website",
  other: "Other",
};

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress payment",
  balance: "Balance",
  full: "Full payment",
  refund: "Refund",
  other: "Other",
};

export const TRI_LABEL: Record<string, string> = { yes: "Yes", no: "No", unknown: "Unknown" };

export const VOTE_LABEL: Record<string, string> = { love: "Love it", like: "Like", unsure: "Unsure", no: "Not for us" };

export const CURRENCIES = ["SGD", "CNY", "USD", "HKD", "MYR", "EUR", "JPY", "AUD", "GBP"];
