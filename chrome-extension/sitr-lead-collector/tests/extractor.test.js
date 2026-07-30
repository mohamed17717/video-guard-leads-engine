import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySocialUrl,
  extractEmailAddresses,
  extractEmailsFromText,
  extractExternalLinks,
  extractPageData,
  extractPhoneNumbers,
  extractPhonesFromText,
  extractSocialLinks,
  extractWhatsappInfo,
  extractWhatsappWidgetNumbers
} from "../services/extractor.js";

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

test("collects phones from visible text, tel links, controls, contact areas, and meta", () => {
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
    "01012345678",
    "01212345678",
    "03 1234567",
    "+966501234567",
    "+201112345678"
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

  assert.deepEqual(
    extractWhatsappInfo(documentRoot, "https://example.com").phones,
    ["201112345678", "966501234567", "201512345678", "01012345678"]
  );
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
    "201027395528"
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
    phones: ["01012345678"],
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
