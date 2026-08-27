# Third-party notices

## gstack

KStack credits [gstack](https://github.com/garrytan/gstack), created by Garry
Tan. KStack began as a narrow derivative informed by gstack's workflow design,
at upstream version 1.61.0.0, and does not include the full gstack runtime.

The current reuse-design audit examined gstack version 1.69.0 at commit
[`ad8400543cd9ce8d07641362db48d44a95417e33`](https://github.com/garrytan/gstack/tree/ad8400543cd9ce8d07641362db48d44a95417e33).
That audit baseline informs proposed Host, Release Automation, and Domain
Breadth work. Those architecture decisions allow only selective,
component-level adaptation; they do not state that every reviewed component,
or any not-yet-admitted upstream source, is present in KStack.

For every file or substantial component later copied from or substantially
adapted from gstack, KStack's admission record must identify:

1. the upstream repository, version, commit, source path, and exact source
   digest;
2. the local file or component, whether it was copied or substantially
   adapted, and a summary of KStack's modifications;
3. the applicable license and the location of its retained notices; and
4. any applicable upstream file-level notice, preserved in the local file when
   its format supports comments or in an adjacent provenance record otherwise.

The full gstack MIT license notice from the audited commit follows verbatim:

```text
MIT License

Copyright (c) 2026 Garry Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

KStack's optional local-memory index uses
[`@electric-sql/pglite`](https://github.com/electric-sql/pglite), version 0.5.4.
The package is distributed under the Apache License 2.0 and incorporates
PostgreSQL components under the PostgreSQL License. The complete license texts
are included with the installed package.
