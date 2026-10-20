// Platform glyphs use the brand-source vectors distributed by Simple Icons.
// LinkedIn keeps its standalone in-mark; marks identify integrations, not endorsement.
import type { SVGProps } from "react";
import { siFacebook, siInstagram, siYoutube, siWhatsapp } from "simple-icons";
export type IconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
function BrandGlyph({ path, ...props }: SVGProps<SVGSVGElement> & { path: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" {...props}><path d={path} /></svg>;
}
export const Facebook: IconComponent = (props) => <BrandGlyph path={siFacebook.path} {...props} />;
export const Instagram: IconComponent = (props) => <BrandGlyph path={siInstagram.path} {...props} />;
export const Youtube: IconComponent = (props) => <BrandGlyph path={siYoutube.path} {...props} />;
export const Whatsapp: IconComponent = (props) => <BrandGlyph path={siWhatsapp.path} {...props} />;
export const Linkedin: IconComponent = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M6.94 5a2 2 0 1 1-4-.02 2 2 0 0 1 4 .02zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-3.96 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.68-2.91V8.48z" />
  </svg>
);
