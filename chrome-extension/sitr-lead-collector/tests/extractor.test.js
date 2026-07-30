import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifySocialUrl,
  extractEmailAddresses,
  extractEmailsFromText,
  extractExternalLinks,
  extractPageData,
  extractPhoneCandidatesFromText,
  extractPhoneNumbers,
  extractPhonesFromText,
  extractSocialLinks,
  extractWhatsappInfo,
  extractWhatsappWidgetNumbers
} from "../services/extractor.js";
import { normalizeExtractedData } from "../services/normalizer.js";

function element({ text = "", attributes = {} } = {}) {
  return {
    innerText: text,
    textContent: text,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    getAttributeNames() {
      return Object.keys(attributes);
    }
  };
}

function documentFixture({
  title = "Example Lead",
  url = "https://example.com/course",
  bodyText = "",
  anchors = [],
  buttons = [],
  contactSections = [],
  meta = [],
  whatsappWidgets = [],
  emailElements = []
} = {}) {
  return {
    title,
    location: { href: url },
    body: element({ text: bodyText }),
    querySelectorAll(selector) {
      if (selector === "a[href]") {
        return anchors;
      }

      if (selector === "button, [role='button']") {
        return buttons;
      }

      if (selector === "meta[content]") {
        return meta;
      }

      if (selector.includes("address") && selector.includes("contact")) {
        return contactSections;
      }

      if (
        selector.includes("joinchat") ||
        selector.includes("data-whatsapp")
      ) {
        return whatsappWidgets;
      }

      if (selector === "[data-email]") {
        return emailElements;
      }

      return [];
    }
  };
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = match[2] ?? match[3] ?? "";
  }

  return attributes;
}

function stripHtml(source) {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function parseElements(html, tagName) {
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  );

  return Array.from(html.matchAll(pattern), (match) =>
    element({
      text: stripHtml(match[2]),
      attributes: parseAttributes(match[1])
    })
  );
}

function loadHtmlFixture(filename) {
  const html = readFileSync(
    new URL(`./fixtures/${filename}`, import.meta.url),
    "utf8"
  );
  const title = stripHtml(
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
  );
  const bodyHtml =
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  const meta = Array.from(
    html.matchAll(/<meta\b([^>]*)>/gi),
    (match) => element({ attributes: parseAttributes(match[1]) })
  );

  return documentFixture({
    title,
    bodyText: stripHtml(bodyHtml),
    anchors: parseElements(bodyHtml, "a"),
    buttons: parseElements(bodyHtml, "button"),
    meta
  });
}

test("extracts Egyptian and international phone formats while rejecting noise", () => {
  const text = [
    "Mobile: 01012345678",
    "Egypt: 201012345678",
    "International: +201112345678",
    "Alternate: 00201512345678",
    "Alexandria office: 03 1234567",
    "Saudi office: +966501234567",
    "Published: 2026-07-30",
    "Price: 123456789 EGP",
    "Order ID: 9876543210",
    "Customer ID: 01099999999",
    "Database key: 123456789012345678"
  ].join("\n");

  assert.deepEqual(extractPhonesFromText(text), [
    "01012345678",
    "201012345678",
    "+201112345678",
    "00201512345678",
    "03 1234567",
    "+966501234567"
  ]);
});

test("rejects compact, spaced, ranged, and date-time values", () => {
  const text = [
    "ISO date and time: 2026-07-30 04:00:00",
    "Spaced date: 30 07 2026",
    "US-style date: 07 30 2026",
    "Compact date: 30072026",
    "Compact ISO date: 20260730",
    "Year range: 2025-2026",
    "Real phone: +201012345678"
  ].join("\n");

  assert.deepEqual(extractPhonesFromText(text), ["+201012345678"]);
});

test("collects structured phones from visible text, tel links, controls, contact areas, and meta", () => {
  const documentRoot = documentFixture({
    bodyText: "General information only.",
    anchors: [
      element({
        text: "Call 01012345678",
        attributes: { href: "tel:+201112345678" }
      })
    ],
    buttons: [element({ text: "Phone: 01212345678" })],
    contactSections: [element({ text: "Contact us on 03 1234567" })],
    meta: [
      element({
        attributes: {
          name: "description",
          content: "Telephone +966501234567"
        }
      })
    ]
  });

  assert.deepEqual(extractPhoneNumbers(documentRoot), [
    {
      raw: "+201112345678",
      context: "Call",
      source: "tel-link"
    },
    {
      raw: "01012345678",
      context: "Call",
      source: "anchor-text"
    },
    {
      raw: "01212345678",
      context: "Phone",
      source: "button-text"
    },
    {
      raw: "03 1234567",
      context: "Contact us on",
      source: "visible-text"
    },
    {
      raw: "+966501234567",
      context: "description Telephone",
      source: "meta-tag"
    }
  ]);
});

test("extracts visible, mailto, metadata, data attribute, and obfuscated emails", () => {
  const documentRoot = documentFixture({
    bodyText: [
      "Email: Hello@Example.COM",
      "Backup: support [at] academy [dot] org"
    ].join("\n"),
    anchors: [
      element({
        text: "Email the team",
        attributes: { href: "mailto:sales@example.com?subject=Hello" }
      })
    ],
    meta: [
      element({
        attributes: {
          name: "description",
          content: "Contact courses@example.net"
        }
      })
    ],
    emailElements: [
      element({ attributes: { "data-email": "hidden@example.edu" } })
    ]
  });

  assert.deepEqual(
    extractEmailsFromText(
      "Hello@Example.COM and support [at] academy [dot] org"
    ),
    ["Hello@example.com", "support@academy.org"]
  );
  assert.deepEqual(extractEmailAddresses(documentRoot), [
    "Hello@example.com",
    "support@academy.org",
    "courses@example.net",
    "sales@example.com",
    "hidden@example.edu"
  ]);
});

test("extracts WhatsApp links, URL numbers, and nearby text numbers", () => {
  const documentRoot = documentFixture({
    bodyText: "For WhatsApp support, message 01012345678 today.",
    anchors: [
      element({ attributes: { href: "https://wa.me/201112345678" } }),
      element({
        attributes: {
          href: "https://api.whatsapp.com/send?phone=966501234567"
        }
      }),
      element({
        attributes: {
          href: "whatsapp://send?phone=201512345678"
        }
      })
    ]
  });

  const phones = extractWhatsappInfo(
    documentRoot,
    "https://example.com"
  ).phones;

  assert.deepEqual(
    phones.map(({ raw }) => raw),
    ["201112345678", "966501234567", "201512345678", "01012345678"]
  );
  assert.equal(phones[0].source, "whatsapp-link");
  assert.equal(phones[3].source, "visible-text");
  assert.match(phones[3].context, /WhatsApp support/);
});

test("extracts WhatsApp numbers from embedded widget configuration", () => {
  const settings = JSON.stringify({
    telephone: "201027395528",
    mobile_only: false,
    whatsapp_web: false,
    button_delay: 3,
    message_send: "مرحبا، محتاج بعض المساعدة"
  });
  const documentRoot = documentFixture({
    whatsappWidgets: [
      element({
        attributes: {
          class: "joinchat joinchat--left joinchat--show",
          "data-settings": settings,
          "aria-hidden": "false"
        }
      })
    ]
  });

  assert.deepEqual(extractWhatsappWidgetNumbers(documentRoot), [
    "201027395528"
  ]);
  assert.deepEqual(extractWhatsappInfo(documentRoot).phones, [
    {
      raw: "201027395528",
      context: "WhatsApp contact button",
      source: "whatsapp-link"
    }
  ]);
});

test("extracts WhatsApp numbers from button attributes and embedded URLs", () => {
  const documentRoot = documentFixture({
    whatsappWidgets: [
      element({
        attributes: {
          role: "button",
          class: "whatsapp-contact-button",
          "data-phone": "+966501234567"
        }
      }),
      element({
        attributes: {
          role: "button",
          onclick:
            "window.open('https://api.whatsapp.com/send?phone=201112345678')"
        }
      })
    ]
  });

  assert.deepEqual(extractWhatsappWidgetNumbers(documentRoot), [
    "+966501234567",
    "201112345678"
  ]);
});

test("classifies supported social platforms", () => {
  const expectedPlatforms = new Map([
    ["https://facebook.com/example", "facebook"],
    ["https://instagram.com/example", "instagram"],
    ["https://tiktok.com/@example", "tiktok"],
    ["https://youtu.be/example", "youtube"],
    ["https://linkedin.com/company/example", "linkedin"],
    ["https://twitter.com/example", "x"],
    ["https://t.me/example", "telegram"],
    ["https://wa.me/201012345678", "whatsapp"],
    ["https://snapchat.com/add/example", "snapchat"]
  ]);

  for (const [url, platform] of expectedPlatforms) {
    assert.equal(classifySocialUrl(url), platform);
  }

  assert.equal(classifySocialUrl("https://instagram.com.evil.test/user"), null);
});

test("returns unique social and external links and excludes internal or invalid links", () => {
  const anchors = [
    element({ attributes: { href: "https://example.com/course" } }),
    element({ attributes: { href: "/about" } }),
    element({ attributes: { href: "#contact" } }),
    element({ attributes: { href: "javascript:void(0)" } }),
    element({ attributes: { href: "mailto:hello@example.com" } }),
    element({ attributes: { href: "tel:+201012345678" } }),
    element({ attributes: { href: "https://instagram.com/example" } }),
    element({ attributes: { href: "https://instagram.com/example#bio" } }),
    element({ attributes: { href: "https://partner.test/offer" } })
  ];
  const documentRoot = documentFixture({ anchors });
  const sourceUrl = "https://example.com/course";

  assert.deepEqual(extractSocialLinks(documentRoot, sourceUrl), [
    {
      platform: "instagram",
      url: "https://instagram.com/example"
    }
  ]);
  assert.deepEqual(extractExternalLinks(documentRoot, sourceUrl), [
    "https://partner.test/offer"
  ]);
});

test("returns the complete extraction result without saving data", () => {
  const capturedAt = "2026-07-30T10:15:00.000Z";
  const documentRoot = documentFixture({
    title: "  Example Course  ",
    url: "https://courses.example.org/lesson",
    bodyText: "Phone: 01012345678",
    anchors: [
      element({ attributes: { href: "https://linkedin.com/company/example" } }),
      element({ attributes: { href: "https://partner.test" } })
    ]
  });

  assert.deepEqual(extractPageData(documentRoot, { capturedAt }), {
    pageTitle: "Example Course",
    sourceUrl: "https://courses.example.org/lesson",
    hostname: "courses.example.org",
    capturedAt,
    phones: [
      {
        raw: "01012345678",
        context: "Phone",
        source: "visible-text"
      }
    ],
    whatsapp: [],
    emails: [],
    socialLinks: [
      {
        platform: "linkedin",
        url: "https://linkedin.com/company/example"
      }
    ],
    externalLinks: ["https://partner.test/"]
  });
});

test("limits phone context instead of retaining full page text", () => {
  const prefix = "Course information ".repeat(30);
  const suffix = " Booking details".repeat(30);
  const candidates = extractPhoneCandidatesFromText(
    `${prefix} Call +201012345678 ${suffix}`
  );

  assert.equal(candidates.length, 1);
  assert.ok(candidates[0].context.length <= 180);
  assert.ok(candidates[0].context.length < prefix.length + suffix.length);
  assert.equal(candidates[0].source, "visible-text");
});

test("extracts accurate English contacts from a representative test page", () => {
  const normalized = normalizeExtractedData(
    extractPageData(loadHtmlFixture("phone-accuracy-english.html"))
  );
  const numbers = normalized.phones.map(({ normalized: value }) => value);
  const byNumber = new Map(
    normalized.phones.map((phone) => [phone.normalized, phone])
  );

  assert.deepEqual(numbers, [
    "+201012345678",
    "+442079460958",
    "+201512345678",
    "+201112345678",
    "+971501234567",
    "+966501234567"
  ]);
  assert.equal(byNumber.get("+201012345678").source, "visible-text");
  assert.equal(byNumber.get("+201112345678").source, "tel-link");
  assert.equal(byNumber.get("+201512345678").source, "button-text");
  assert.equal(byNumber.get("+971501234567").source, "meta-tag");
  assert.equal(byNumber.get("+966501234567").source, "whatsapp-link");
  assert.ok(
    normalized.phones.every(
      ({ context }) => context.length > 0 && context.length <= 180
    )
  );
});

test("extracts Arabic text and Arabic-Indic digits while rejecting Arabic noise", () => {
  const normalized = normalizeExtractedData(
    extractPageData(loadHtmlFixture("phone-accuracy-arabic.html"))
  );
  const byNumber = new Map(
    normalized.phones.map((phone) => [phone.normalized, phone])
  );

  assert.deepEqual(Array.from(byNumber.keys()), [
    "+201012345678",
    "+201212345678",
    "+201112345678",
    "+201022222222",
    "+966551234567"
  ]);
  assert.equal(byNumber.get("+201012345678").raw, "٠١٠١٢٣٤٥٦٧٨");
  assert.match(
    byNumber.get("+201012345678").context,
    /للتواصل والحجز عبر واتساب/
  );
  assert.equal(byNumber.get("+201112345678").source, "tel-link");
  assert.equal(byNumber.get("+201212345678").source, "button-text");
  assert.equal(byNumber.get("+201022222222").source, "meta-tag");
  assert.equal(byNumber.get("+966551234567").source, "whatsapp-link");
});
