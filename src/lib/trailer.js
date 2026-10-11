/* Only a video ID reaches an embed or native YouTube launcher, never an
   arbitrary URL imported with a movie. Invalid/missing IDs use search. */
export function youtubeVideoId(value) {
  if (typeof value !== 'string') return null;
  var text = value.trim(), id = text;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    try {
      var url = new URL(text);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1];
      else if (/^(www\.|m\.)?youtube\.com$/.test(url.hostname)) {
        id = url.searchParams.get('v') || (/^\/(embed|shorts|v)\//.test(url.pathname) ? url.pathname.split('/')[2] : null);
      } else return null;
    } catch { return null; }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
}

export function trailerTarget(movie, cached) {
  var videoId = youtubeVideoId(movie._yt) || youtubeVideoId(cached && cached.ytKey);
  var query = [movie.title || '', movie.year || '', 'trailer'].filter(Boolean).join(' ').slice(0, 300);
  return {
    videoId: videoId || '', query,
    url: videoId ? 'https://www.youtube.com/watch?v=' + videoId :
      'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
  };
}
