/**
 * Runs the hourly video preview backfill once, for testing or catching up.
 *
 *   pnpm video-previews
 */
import { runVideoPreviewBackfill } from "../lib/media/video-previews";

runVideoPreviewBackfill(240_000)
  .then((made) => console.log(`made previews for ${made} video(s)`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
