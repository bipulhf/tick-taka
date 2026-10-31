/** The parts of Google Identity Services (accounts.google.com/gsi/client) the sign-in page uses. */
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  ux_mode?: "popup" | "redirect";
  use_fedcm_for_prompt?: boolean;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: GoogleIdConfiguration): void;
        renderButton(
          parent: HTMLElement,
          options: {
            type?: "standard" | "icon";
            theme?: "outline" | "filled_blue" | "filled_black";
            size?: "large" | "medium" | "small";
            text?: "signin_with" | "continue_with";
            shape?: "pill" | "rectangular";
            width?: number;
            logo_alignment?: "left" | "center";
            locale?: string;
          },
        ): void;
        disableAutoSelect(): void;
      };
    };
  };
}
