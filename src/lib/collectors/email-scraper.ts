import axios from "axios";

// Common file extensions or tech providers that appear in HTML but are not real business contacts
const IGNORED_DOMAINS = [
  "sentry.io",
  "wixpress.com",
  "wix.com",
  "wordpress.org",
  "wordpress.com",
  "cloudflare.com",
  "googleapis.com",
  "google.com",
  "schema.org",
  "example.com",
  "domain.com",
  "email.com",
  "yourdomain.com",
  "bootstrap.com",
  "github.com",
  "themeforest.net",
  "envato.com",
];

const IGNORED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];

export class EmailScraper {
  /**
   * Scrapes public business email from a website URL.
   * Checks homepage first, then follows /contact or /about if needed.
   */
  public static async scrapeEmailFromWebsite(websiteUrl: string): Promise<string | null> {
    if (!websiteUrl || typeof websiteUrl !== "string") return null;

    let targetUrl = websiteUrl.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      const domain = new URL(targetUrl).hostname.replace(/^www\./, "").toLowerCase();

      // 1. Scrape Homepage
      const homepageResult = await this.fetchAndExtract(targetUrl, domain);
      if (homepageResult.email) {
        return homepageResult.email;
      }

      // 2. If no email on homepage, check for Contact / About link
      if (homepageResult.contactLink) {
        let contactUrl = homepageResult.contactLink;
        if (contactUrl.startsWith("/")) {
          const origin = new URL(targetUrl).origin;
          contactUrl = `${origin}${contactUrl}`;
        } else if (!contactUrl.startsWith("http")) {
          const origin = new URL(targetUrl).origin;
          contactUrl = `${origin}/${contactUrl}`;
        }

        const contactResult = await this.fetchAndExtract(contactUrl, domain);
        if (contactResult.email) {
          return contactResult.email;
        }
      }

      // 3. Fallback: try common /contact paths directly
      const commonContactPaths = ["/contact", "/contact-us", "/about-us"];
      for (const path of commonContactPaths) {
        try {
          const origin = new URL(targetUrl).origin;
          const directUrl = `${origin}${path}`;
          const res = await this.fetchAndExtract(directUrl, domain);
          if (res.email) return res.email;
        } catch {
          // ignore direct contact trial failures
        }
      }

      return null;
    } catch (err: any) {
      console.warn(`[EmailScraper] Failed to scrape ${websiteUrl}:`, err.message);
      return null;
    }
  }

  /**
   * Fetches an HTML page and extracts candidate emails + contact links
   */
  private static async fetchAndExtract(
    url: string,
    domain: string
  ): Promise<{ email: string | null; contactLink: string | null }> {
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });

      const html = typeof res.data === "string" ? res.data : "";
      if (!html) return { email: null, contactLink: null };

      // 1. High priority: mailto: links
      const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const mailtoMatches: string[] = [];
      let match;
      while ((match = mailtoRegex.exec(html)) !== null) {
        if (match[1]) mailtoMatches.push(match[1].toLowerCase());
      }

      const validMailtos = mailtoMatches.filter((e) => this.isValidEmail(e));
      if (validMailtos.length > 0) {
        const bestMailto = this.pickBestEmail(validMailtos, domain);
        return { email: bestMailto, contactLink: null };
      }

      // 2. Medium priority: raw email regex in HTML
      const rawRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const rawMatches = (html.match(rawRegex) || [])
        .map((e) => e.toLowerCase())
        .filter((e) => this.isValidEmail(e));

      if (rawMatches.length > 0) {
        const bestRaw = this.pickBestEmail(rawMatches, domain);
        return { email: bestRaw, contactLink: null };
      }

      // 3. Find Contact page link if no email found
      const contactLinkMatch = html.match(
        /href=["']([^"']*(?:contact|reach|about)[^"']*)["']/i
      );
      const contactLink = contactLinkMatch ? contactLinkMatch[1] : null;

      return { email: null, contactLink };
    } catch {
      return { email: null, contactLink: null };
    }
  }

  /**
   * Validates if a string looks like a legitimate business email
   */
  private static isValidEmail(email: string): boolean {
    if (!email || email.length > 80 || email.length < 5) return false;
    if (!email.includes("@") || !email.includes(".")) return false;

    // Check false image match (e.g. logo@2x.png)
    for (const ext of IGNORED_EXTENSIONS) {
      if (email.endsWith(ext)) return false;
    }

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return false;

    for (const ignored of IGNORED_DOMAINS) {
      if (emailDomain === ignored || emailDomain.endsWith(`.${ignored}`)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sorts candidate emails and selects the best representative business contact
   */
  private static pickBestEmail(candidates: string[], websiteDomain: string): string {
    const unique = Array.from(new Set(candidates));

    // Priority prefixes: info@, contact@, hello@, etc.
    const priorityPrefixes = [
      "info@",
      "contact@",
      "hello@",
      "support@",
      "booking@",
      "bookings@",
      "sales@",
      "admin@",
      "enquiries@",
      "team@",
    ];

    // 1. Same domain + priority prefix
    for (const prefix of priorityPrefixes) {
      const match = unique.find(
        (e) => e.startsWith(prefix) && e.endsWith(`@${websiteDomain}`)
      );
      if (match) return match;
    }

    // 2. Same domain
    const sameDomainMatch = unique.find((e) => e.endsWith(`@${websiteDomain}`));
    if (sameDomainMatch) return sameDomainMatch;

    // 3. Any domain + priority prefix
    for (const prefix of priorityPrefixes) {
      const match = unique.find((e) => e.startsWith(prefix));
      if (match) return match;
    }

    // 4. First valid candidate
    return unique[0];
  }
}
