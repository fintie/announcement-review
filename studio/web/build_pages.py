"""Export the public UI only; never copies local data or Python environments."""
from pathlib import Path
import re
import shutil
import subprocess
root=Path(__file__).resolve().parents[2]
out=root/'terminal'
out.mkdir(exist_ok=True)
s=(root/'studio'/'index.html').read_text()
s=re.sub(r'<script>.*?</script>','',s,flags=re.S)
a=s.index('<details class="connection"');b=s.index('</details>',a)+len('</details>')
s=s[:a]+'''<details class="connection"><summary>Network connection <span id="unlock-status">Connecting…</span></summary><section><label>IMD bridge URL<input id="hosted-bridge" type="url" value="https://announcement-review-imd.onrender.com" style="width:100%"></label><button id="connect">Connect network</button><p class="muted">Public network requests use this bridge. Your request credential is generated in this page and is never stored by the bridge.</p><button id="export-credential" class="secondary">Export request credential & order IDs</button><label>Restore a saved request credential<input id="import-credential" type="file" accept="application/json,.json"></label><p class="muted">Export your credential before leaving this page if you create an order. Keep the file private. Wallet keys are never included.</p><input id="token" type="hidden" value=""><select id="model" hidden></select></section></details>'''+s[b:]
a=s.index('<div id="tab-local"');b=s.index('<footer>',a);s=s[:a]+s[b:]
s=s.replace('<button data-tab="local">Local review</button>','<a href="http://127.0.0.1:8765/" target="_blank" rel="noreferrer">Local app ↗</a><a href="../">Announcement workspace ↗</a>')
# Keep a hidden local panel for the shared tab controller; no local API script ships here.
s=s.replace('<footer>','<div id="tab-local" hidden></div><footer>',1)
s=s.replace('ETHEREUM · LOCAL CLIENT','ETHEREUM · IMD CLIENT')
s=s.replace('Unlock with your local access token to load IMD data.','Connecting to the live IMD network…')
s=s.replace('The request credential is stored privately on this Mac. The wallet’s paid history is also available in Network.','Export your request credential from Network connection before leaving this page. Restore it to recover these orders. Wallet paid history is also available in Network.')
s=s.replace('Local review documents stay local unless you include them in a request.','Only submit information you intend to share with IMD.')
s=s.replace('src="/assets/imd-client.js"','src="./assets/imd-client.js"').replace('href="/assets/imd.css"','href="./assets/imd.css"')
s=s.replace('STUDIO · IMD network client','STUDIO · IMD network client · Pages terminal release 2026.10.19')
(out/'index.html').write_text(s)
(out/'assets').mkdir(exist_ok=True)
shutil.copyfile(root/'studio'/'assets'/'imd.css',out/'assets'/'imd.css')
subprocess.run([str(root/'studio'/'web'/'node_modules'/'.bin'/'esbuild'),str(root/'studio'/'web'/'client.js'),'--bundle','--minify','--format=esm','--target=es2022','--define:__STUDIO_HOSTED__=true','--outfile='+str(out/'assets'/'imd-client.js')],check=True)
print('Exported GitHub Pages interface. Local runtime data excluded.')
