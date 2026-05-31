export async function onRequest(context) {
  const url = new URL(context.request.url);
  const canonicalUrl = new URL(url);
  let shouldRedirect = false;

  if (canonicalUrl.hostname === "www.localkit.dev") {
    canonicalUrl.hostname = "localkit.dev";
    shouldRedirect = true;
  }

  if (canonicalUrl.protocol === "http:") {
    canonicalUrl.protocol = "https:";
    shouldRedirect = true;
  }

  if (
    canonicalUrl.pathname === "/" &&
    canonicalUrl.searchParams.get("q") === "{search_term_string}"
  ) {
    canonicalUrl.searchParams.delete("q");
    shouldRedirect = true;
  }

  const hasFileExtension = /\.[^/]+$/.test(canonicalUrl.pathname);

  if (!hasFileExtension && !canonicalUrl.pathname.endsWith("/")) {
    canonicalUrl.pathname += "/";
    shouldRedirect = true;
  }

  if (shouldRedirect) {
    return Response.redirect(canonicalUrl.toString(), 301);
  }

  return context.next();
}
