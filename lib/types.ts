interface WalletResponse {
  action?: string;
  data?: any;
  error?: string;
}

interface ModalStyles {
  backgroundColor?: string;
  width?: string;
  padding?: string;
}

interface ResponseListenerData {
  action: string;
  resolve: (response: any) => void;
}
