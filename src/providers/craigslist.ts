import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { NormalizedListing, ListingProvider } from '../types.js';

interface GmailConfig {
  user: string;
  password: string;
}

interface ParsedBlock {
  price: number;
  bedrooms: number;
  sqft: number | null;
  title: string;
  neighborhood: string;
  url: string;
}

function parseListingBlocks(text: string): ParsedBlock[] {
  // Split on the separator lines
  const blocks = text.split(/={3,}/);
  const results: ParsedBlock[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Match the first line: $2,350 - 4br - 1217ft2 - title text
    const headerMatch = trimmed.match(/^\$([\d,.]+)\s*-\s*(\d+)br\s*-\s*([\d,]+)ft2\s*-\s*(.+)/m);
    if (!headerMatch) continue;

    const price = parseFloat(headerMatch[1].replace(/,/g, ''));
    const bedrooms = parseInt(headerMatch[2], 10);
    const sqft = parseInt(headerMatch[3].replace(/,/g, ''), 10);
    const title = headerMatch[4].trim();

    // Extract URL
    const urlMatch = trimmed.match(/(https:\/\/[a-z]+\.craigslist\.org\/apa\/d\/[^\s]+\.html)/);
    if (!urlMatch) continue;

    // Extract neighborhood: "(South Austin)" on its own line
    const neighborhoodMatch = trimmed.match(/\(([^)]+)\)/);
    const neighborhood = neighborhoodMatch ? neighborhoodMatch[1].trim() : '';

    results.push({ price, bedrooms, sqft, title, neighborhood, url: urlMatch[1] });
  }

  return results;
}

function blockToListing(block: ParsedBlock): NormalizedListing {
  const idMatch = block.url.match(/\/(\d+)\.html/);
  const listingId = idMatch ? `cl-${idMatch[1]}` : `cl-${Date.now()}`;

  return {
    listing_id: listingId,
    source: 'craigslist',
    address: '',
    neighborhood: block.neighborhood,
    price: block.price,
    bedrooms: block.bedrooms,
    bathrooms: 0, // Not in email alerts
    sqft: block.sqft,
    home_type: 'unknown',
    features: [],
    description: block.title,
    image_url: null,
    url: block.url,
    status: 'active',
  };
}

export function createCraigslistProvider(gmailConfig: GmailConfig): ListingProvider {
  return {
    name: 'craigslist',

    async fetchListings() {
      console.log('[craigslist] Checking Gmail for Craigslist alerts...');

      let connection: imapSimple.ImapSimple | null = null;

      try {
        connection = await imapSimple.connect({
          imap: {
            user: gmailConfig.user,
            password: gmailConfig.password,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000,
          },
        });

        await connection.openBox('INBOX');

        // Search for unread emails from Craigslist in the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const messages = await connection.search(
          [
            'UNSEEN',
            ['FROM', 'craigslist'],
            ['SINCE', dateStr],
          ],
          {
            bodies: [''],
            markSeen: true,
          },
        );

        console.log(`[craigslist] Found ${messages.length} unread Craigslist emails`);

        const allListings: NormalizedListing[] = [];

        for (const msg of messages) {
          const rawBody = msg.parts.find((p: any) => p.which === '')?.body || '';
          const parsed = await simpleParser(rawBody);
          const text = parsed.text || '';

          // Skip non-alert emails (account signup, etc.)
          if (!text.includes('craigslist.org/apa/')) continue;

          const blocks = parseListingBlocks(text);
          for (const block of blocks) {
            allListings.push(blockToListing(block));
          }
        }

        // Deduplicate by listing_id
        const seen = new Set<string>();
        const unique = allListings.filter((l) => {
          if (seen.has(l.listing_id)) return false;
          seen.add(l.listing_id);
          return true;
        });

        console.log(`[craigslist] Extracted ${unique.length} unique listings from emails`);
        return unique;
      } catch (err: any) {
        console.error('[craigslist] IMAP fetch failed:', err.message);
        return [];
      } finally {
        if (connection) {
          connection.end();
        }
      }
    },
  };
}
