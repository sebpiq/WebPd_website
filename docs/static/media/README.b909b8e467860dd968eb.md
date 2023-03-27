<p align="center">
  <img src="webpd.png" />
</p>

<!-- intro start -->

<p><strong>WebPd</strong> is a compiler for audio programming language <a href="https://puredata.info/">Pure Data</a> allowing to run <strong>.pd</strong> patches on web pages. </p>
<p><strong>WebPd is highly modular and takes a white-box approach to audio programming</strong>. It aims to enable people with different levels of expertise to use the programming environment they feel most confortable with. The output of the compiler is plain human-readable JavaScript or <a href="https://www.assemblyscript.org/">AssemblyScript</a> (*). This means that you&#39;re free to take the generated code and work directly with it in your own web application without using WebPd or Pure Data ever again 🌈.</p>
<!-- intro end -->

<p>WebPd simply generates audio code so adding visuals and interactivity is up to you. Indeed, there are plenty of good JavaScript libraries to build interactive visual interfaces such as <a href="https://threejs.org/">Three.js</a>, <a href="https://p5js.org/">p5.js</a>, good old JavaScript / HTML / CSS, etc. Integrating them with a WebPd patch should be fairly easy. An example of such integration is the <em>patch player</em> demo, available through <a href="#using-the-web-compiler">the web compiler</a>. As a result, WebPd is <strong>not</strong>, in itself, a complete editor and a live performance platform as Pure Data is. The Pure Data graphical interface, as well as GEM, are out of the scope of WebPd. WebPd isn&#39;t either a simple executor like libpd. It is rather a lean audio compiler, which generates high-performance, human-readable and easily integrable audio code with no bloat.</p>
<p><em>(*) AssemblyScript is a TypeScript-style language which compiles to WebAssembly.</em></p>
<p><a href="https://github.com/sponsors/sebpiq"><img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23ed00d9" alt=""></a></p>
<h2 id="usage">Usage</h2>
<p><span id="using-the-web-compiler"><span></p>
<h3 id="web-compiler-and-player">Web compiler and player</h3>
<p><strong>The web compiler and a patch player are live at the following address: <a href="https://sebpiq.github.io/WebPd_website">https://sebpiq.github.io/WebPd_website</a></strong></p>
<p>Just upload or give a URL(*) of a patch, compile it just in time and generate an interface allowing to play that patch in realtime in your browser. Once the compilation succeeds, you can copy and share with others the resulting URL from the player(**). This URL contains all the modified parameters of the patch you have played with, so that it is shared completely in its <em>current</em> state.</p>
<p><em>(*)You can use any public URL of a patch found in the wild (on github, Pure Data forums, etc.).</em></p>
<p><em>(**)Sharing a compiled patch doesn&#39;t work if you used local files for compilation.</em></p>
<p><span id="using-the-cli"><span></p>
<h3 id="command-line-interface">Command line interface</h3>
<p>The command-line interface (CLI) offers more customization options, including the ability to generate a fully-functional (but bare bones) web page embedding your patch.</p>
<p>Open a terminal and install the CLI with <a href="https://nodejs.org/">node / npm</a> by running the following command:</p>
<pre><code>npm install -g webpd
</code></pre>
<p>Verify that installation worked by running:</p>
<pre><code>webpd --help
</code></pre>
<p>This should output help for the CLI and will hopefully get you started.</p>
<h3 id="getting-help">Getting help</h3>
<p>If you feel stuck, there&#39;s <a href="https://puredata.info/community">plenty of places</a> where you can ask for help. I recommend in particular <a href="https://discord.gg/AZ43djV">the discord server</a> where you can get help quickly and find support from the community.</p>
<p>If you feel you might have stumbled upon a bug, please report it following <a href="#reporting-a-bug">these simple guidelines</a>.</p>
<h3 id="you-are-using-webpd">You are using WebPd?</h3>
<p>Great 🌱 ! It helps a lot with motivation to hear that people are using it. Don&#39;t hesitate to let me know by pinging me on twitter <a href="https://twitter.com/sebpiq">@sebpiq</a>, or <a href="https://second-hander.com/">writing me directly by email</a>.</p>
<p>If you can afford it, you can also <a href="https://opencollective.com/webpd">donate</a> to help move development forward.</p>
<h2 id="development">Development</h2>
<h3 id="status--roadmap">Status &amp; roadmap</h3>
<p>WebPd is currently under heavy development, but it is still a work in progress. A list of implemented objects, features and the roadmap are <a href="https://github.com/sebpiq/WebPd/blob/main/ROADMAP.md">here</a>.</p>
<p>The project is currently in <em>alpha release state</em> which means that many of your patches will <em>not</em> work out of the box. Many objects and features are indeed still missing. If you feel there is a bug, thanks for reporting it following <a href="#reporting-a-bug">these simple guidelines</a>. If you feel you could develop an object that is missing in WebPd to play a specific patch, see <a href="#contributing">contributing</a>.</p>
<p><span id="reporting-a-bug"><span></p>
<h3 id="reporting-a-bug">Reporting a bug</h3>
<p>If you wish to report a bug:</p>
<ul>
<li>First narrow it down. Remove all objects in your patch that are not related with the bug. Try to find the simplest patch with which this bug can be reproduced.</li>
<li>Then submit a bug report <a href="https://github.com/sebpiq/WebPd/issues">in github</a> with the following template :</li>
</ul>
<pre><code>Patch and description -&gt; Upload your minimal patch

Current behavior -&gt; Describe shortly how it is working at the moment

Expected behavior -&gt; Describe shortly how it should work instead
</code></pre>
<p><span id="contributing"><span></p>
<h3 id="contributing">Contributing</h3>
<p>One-time contributions or regular work on the library are more than welcome! Contribution guidelines are coming, meanwhile if you have time and would really like to get involved please get in touch on the issue tracker on GitHub. I would be pleased to help you getting started for contributing.</p>
<p>In case you would like to try developping a new object, here are some good examples to start with:</p>
<ul>
<li><a href="https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip.ts">clip.ts</a></li>
<li><a href="https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip~.ts">clip~.ts</a></li>
</ul>
<p>If you want to dig deeper into the code, WebPd is built in several sub-packages in addition to this one which combines them all : </p>
<ul>
<li>Pd file parser : <a href="https://github.com/sebpiq/WebPd_pd-parser">https://github.com/sebpiq/WebPd_pd-parser</a></li>
<li>WebPd compiler : <a href="https://github.com/sebpiq/WebPd_compiler">https://github.com/sebpiq/WebPd_compiler</a></li>
<li>WebPd runtime : <a href="https://github.com/sebpiq/WebPd_runtime">https://github.com/sebpiq/WebPd_runtime</a></li>
</ul>
<h2 id="license">License</h2>
<p>WebPd is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License version 3 as published by the Free Software Foundation.</p>
<p>WebPd is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License or read the <a href="https://github.com/Ircam-WAM/WebPd/blob/main/COPYING.LESSER">COPYING.LESSER</a> file for more details.</p>
<h2 id="authors">Authors</h2>
<ul>
<li>Sébastien Piquemal <a href="mailto:&#x73;&#x65;&#x62;&#112;&#x69;&#x71;&#64;&#112;&#x72;&#x6f;&#x74;&#x6f;&#110;&#109;&#x61;&#x69;&#108;&#x2e;&#99;&#111;&#x6d;">&#x73;&#x65;&#x62;&#112;&#x69;&#x71;&#64;&#112;&#x72;&#x6f;&#x74;&#x6f;&#110;&#109;&#x61;&#x69;&#108;&#x2e;&#99;&#111;&#x6d;</a></li>
<li>Chris McCormick</li>
<li>Brandon James</li>
<li>mgsx-dev</li>
<li>Atul Varma</li>
<li>Ulric Wilfred</li>
<li>Paul Money</li>
</ul>
<h2 id="acknowledgment-and-sponsors">Acknowledgment and sponsors</h2>
<p>This project has been sponsored by the <a href="https://dafneplus.eu/">DAFNE+</a> european research project funded by the European Union within the &quot;Horizon Europe&quot; program (Grant Agreement 101061548) and <a href="https://www.ircam.fr">IRCAM</a> within the WAM team from december 2022 to march 2023.</p>
