import { NextResponse } from "next/server";
import { cacheSet } from "@/lib/redis";
import type { RedditSignal } from "@/lib/types";

// Called by Vercel Cron every 30 minutes
// Add to vercel.json: { "crons": [{ "path": "/api/reddit-signal", "schedule": "*/30 * * * *" }] }
export async function GET() {
  try {
    const signal = await fetchRedditSignal();
    await cacheSet("reddit_signal", signal, 3600); // 1h TTL
    return NextResponse.json(signal);
  } catch (err) {
    console.error("[reddit-signal]", err);
    return NextResponse.json(
      { error: "Failed to fetch Reddit signal" },
      { status: 500 }
    );
  }
}

async function fetchRedditSignal(): Promise<RedditSignal> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      sentiment: "unknown",
      postCount: 0,
      label: "Local signal not configured",
      fetchedAt: new Date().toISOString(),
    };
  }

  // Get access token via client credentials
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LightParis/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) throw new Error(`Reddit auth error: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // Search r/paris for recent weather posts (last 24h)
  const searchRes = await fetch(
    "https://oauth.reddit.com/r/paris/search?q=soleil+OR+pluie+OR+météo+OR+weather+OR+sunny+OR+nuages&sort=new&limit=25&t=day",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "LightParis/1.0",
      },
    }
  );

  if (!searchRes.ok) throw new Error(`Reddit search error: ${searchRes.status}`);
  const searchData = await searchRes.json();

  const posts: RedditPost[] = searchData.data?.children?.map(
    (c: { data: RedditPost }) => c.data
  ) ?? [];

  return analyseRedditPosts(posts);
}

interface RedditPost {
  title: string;
  selftext: string;
  created_utc: number;
}

const SUNNY_KEYWORDS = /soleil|sunny|☀️|ensoleillé|beau temps|grand soleil|clair/i;
const CLOUDY_KEYWORDS = /nuages|nuageux|couvert|cloudy|overcast|gris/i;
const RAINY_KEYWORDS = /pluie|pluvieux|rain|raining|mouillé|orage|storm/i;

function analyseRedditPosts(posts: RedditPost[]): RedditSignal {
  let sunny = 0;
  let cloudy = 0;
  let rainy = 0;

  for (const post of posts) {
    const text = `${post.title} ${post.selftext}`;
    if (RAINY_KEYWORDS.test(text)) rainy++;
    else if (CLOUDY_KEYWORDS.test(text)) cloudy++;
    else if (SUNNY_KEYWORDS.test(text)) sunny++;
  }

  const total = sunny + cloudy + rainy;
  let sentiment: RedditSignal["sentiment"] = "unknown";
  let label = "No recent weather posts";

  if (total > 0) {
    if (rainy > cloudy && rainy > sunny) {
      sentiment = "rainy";
      label = `Locals reporting rain (${rainy} posts)`;
    } else if (cloudy > sunny) {
      sentiment = "cloudy";
      label = `Locals reporting clouds (${cloudy} posts)`;
    } else if (sunny > 0) {
      sentiment = "sunny";
      label = `Locals say it's sunny (${sunny} posts)`;
    }
  }

  return {
    sentiment,
    postCount: total,
    label,
    fetchedAt: new Date().toISOString(),
  };
}
