# lh-audit

Lighthouse audit (`lh-audit`) runs 5 lighthouse performance audits and displays the [geometric mean](https://en.wikipedia.org/wiki/Geometric_mean) (short "gmean") of it.

![Screenshot](/screenshot.png?raw=true)

It uses a headless chrome to execute lighthouse. It also uses the `devtools` throttling method.

## Usage

Add file ./bin/urls-to-check.js where an array of urls is provided. Import file in lh-audit.js as urlsToCheck. Run program in shell.

```
lh-audit [options]

Options:
  -s, --store-logs  store lighthouse logs in ./storedLogs
  -h, --help        output usage information
```

## Metrics

| Metric  | Name                          | Description               |
| ------- | ----------------------------- | ------------------------- |
| _p_     | The overall performance score | A value between 0 and 100 |
| _fcp_   | First contentful paint        |                           |
| _fmp_   | First meaningful paint        |                           |
| _speed_ | Speed index                   |                           |
| _tti_   | Time to interactive           |                           |
| _cpu_   | First CPU idle                |                           |
| _size_  | Total byte weight             |                           |

## Details

Each performance sub-metric (fcp, fmp, speed, tti and cpu) shows a time in seconds and in parenthesize the reached sub-score.

E.g. `cpu: 7.45 s (5.1/13.3)` says, that the cpu metric took `7.45` seconds to complete and that it got a total score of `5.1` out of possibly `13.3` points. Currently the cpu metric is weighted 2 out of 15, so a 100% in cpu adds 13.3 points to the overall score.

The overall performance score simply shows the achieved score.

The size metric does not directly influence the overall performance. But of cause it indirectly affects the other metrics.

## License

MIT
