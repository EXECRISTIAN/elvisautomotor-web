// Fetches resources with extension privileges (bypasses page CORS) and returns data URLs.
async function toDataURL(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const type = blob.type || 'application/octet-stream';
  return { dataUrl: `data:${type};base64,${btoa(bin)}`, type, text: /text|css|javascript|json|svg|xml/.test(type) ? new TextDecoder().decode(buf) : null };
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'fetch') { toDataURL(msg.url).then(reply, e => reply({ error: String(e) })); return true; }
  if (msg.type === 'download') {
    const url = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(msg.html)));
    chrome.downloads.download({ url, filename: msg.name, saveAs: true }).then(id => reply({ id }), e => reply({ error: String(e) }));
    return true;
  }
});
