tti-measure
=============

A simple script to measure the time-to-interactive of a remote or local website. See the [blogpost](https://medium.com/@pldubouilh/automated-time-to-interactive-measurement-cfd6d16e3b59) for more information and background.

```
🚀🚀 tti-measure 🚀🚀

  Automated, headless-able time-to-interactive measurement

  E.g.: tti-measure -u "https://greta.io" -u "http://127.0.0.1:9999/test.html"

  -u, --url      Compulsory arg    Urls to run the script on. Pass multiple -u to test multiple urls
  -r, --runs     Default: 2        Number of runs per page
  -t, --target   Default: 2500     Retuns non-zero if a test fails to load within the target time (ms)
  -c, --chrome   Default: 9222     Headless chrome port
  -v, --debug    Default: false    Log verbosity
  -p, --profile  Default: 3gDsl    Network profile. '3gDsl' runs the tests on 3g and on dsl.
                                   Note that profiles are currently not working in headless
                                   Cf https://bugs.chromium.org/p/chromium/issues/detail?id=728451

  Valid network profile ['3g', 'dsl', 'uncap', '3gDsl']
```

### Install

```bash
# Install
npm i -g tti-measure

# Run chrome on MacOS with remote debugging enabled
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# ... or on GNU/Linux
google-chrome --remote-debugging-port=9222

#For headless, just append to the command : --headless --disable-gpu
```

Then, just execute `tti-measure -u "https://greta.io"` to have an idea of the time-to-interactive on our homepage. It will run the page twice on `3g` profile and twice on the `dsl` profile, and print an average.

```
$ tti-measure -u "https://greta.io"

🚀🚀 tti-measure 🚀🚀

  Chrome connected

-----------------#  Average TTI  #-----------------
{
  "https://greta.io": {
    "3g": 863.5,
    "dsl": 579.5
  }
}
---------------------------------------------------
```
