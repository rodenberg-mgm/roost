// Type declaration for resend package
// Needed because resend v6 only ships .d.mts/.d.cts types which
// some build environments (Vercel) don't resolve correctly.
declare module "resend" {
  export class Resend {
    constructor(apiKey?: string);
    emails: {
      send: (options: {
        from: string;
        to: string | string[];
        subject: string;
        html?: string;
        react?: React.ReactElement;
        text?: string;
      }) => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
    };
  }
}
