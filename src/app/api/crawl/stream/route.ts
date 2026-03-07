import { crawlAllActiveRegions } from "@/crawler/crawl";
import { sendAlerts } from "@/crawler/alerts";
import type { CrawlEvent } from "@/lib/crawl-events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

let crawlInProgress = false;

export async function GET() {
  if (crawlInProgress) {
    return new Response("Crawl already in progress", { status: 409 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: CrawlEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Controller already closed
        }
      };

      controller.enqueue(encoder.encode(`: connected\n\n`));

      crawlInProgress = true;
      crawlAllActiveRegions(send)
        .then(async (results) => {
          const hasChanges = results.some(
            (r) =>
              "newListings" in r &&
              (r.newListings > 0 || r.updatedListings > 0)
          );
          if (hasChanges) {
            await sendAlerts();
          }
        })
        .catch((err) => {
          send({
            type: "crawl:error",
            message: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(() => {
          crawlInProgress = false;
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
