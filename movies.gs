/***************************************
 * MOVIE QUEUE FILE (STANDALONE SAFE)
 * movies.gs
 ***************************************/

const SHEET_ID = "1svWLSUunoM-Hl1ofF4Y5cFUoc9oCmbE6EyR_hAuZZDg"; // ✅ CONFIRMED
const SHEET_NAME = "MovieQueue";

/**
 * Fetch full movie data from Google Sheet
 * Column A → Movie Name
 * Column B → YouTube Trailer URL
 */
function getMovieDataFromSheet() {
  const sheet = SpreadsheetApp
    .openById(SHEET_ID)
    .getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("❌ Sheet 'MovieQueue' not found");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet
    .getRange(2, 1, lastRow - 1, 2)
    .getValues()
    .filter(r => r[0]);

  return data.map(r => ({
    name: r[0],
    trailer: r[1] || ""
  }));
}

/**
 * Get next movie (with trailer)
 */
function getNextMovie() {
  const props = PropertiesService.getScriptProperties();
  let index = Number(props.getProperty("MOVIE_INDEX"));

  if (isNaN(index) || index < 0) index = 0;

  const movies = getMovieDataFromSheet();

  if (movies.length === 0) {
    Logger.log("❌ No movies found in sheet");
    return null;
  }

  if (index >= movies.length) {
    Logger.log("✅ All movies completed. No more movies to post.");
    return null;
  }

  const movie = movies[index];
  props.setProperty("MOVIE_INDEX", index + 1);

  Logger.log(
    `🎬 Posting movie (${index + 1}/${movies.length}): ${movie.name}`
  );

  return movie; // { name, trailer }
}

/**
 * Reset movie queue
 */
function resetMovieQueue() {
  PropertiesService
    .getScriptProperties()
    .setProperty("MOVIE_INDEX", 0);

  Logger.log("🔁 Movie queue reset");
}

/**
 * Force authorization (run once manually)
 */
function forceAuthorize() {
  SpreadsheetApp.openById(SHEET_ID).getSheets();
}
