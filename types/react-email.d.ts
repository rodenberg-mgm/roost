// Type declaration for @react-email/components
// Needed because the package's types don't resolve in Vercel's build environment.
declare module "@react-email/components" {
  import type { FC, ReactNode, CSSProperties } from "react";

  interface BaseProps {
    children?: ReactNode;
    style?: CSSProperties;
  }

  interface ButtonProps extends BaseProps {
    href?: string;
  }

  export const Html: FC<BaseProps>;
  export const Head: FC<BaseProps>;
  export const Preview: FC<BaseProps>;
  export const Body: FC<BaseProps>;
  export const Container: FC<BaseProps>;
  export const Section: FC<BaseProps>;
  export const Text: FC<BaseProps>;
  export const Heading: FC<BaseProps>;
  export const Button: FC<ButtonProps>;
  export const Link: FC<ButtonProps>;
  export const Img: FC<BaseProps & { src?: string; alt?: string; width?: number; height?: number }>;
  export const Hr: FC<BaseProps>;
  export const Column: FC<BaseProps>;
  export const Row: FC<BaseProps>;

  export function render(element: React.ReactElement): Promise<string>;
}
