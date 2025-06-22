<p align="center">
    <a href="#contributing">
        <img src="https://img.shields.io/badge/PRs-welcome-0?style=flat-square&labelcolor=202b2d&color=4a5568" alt="PRs welcome"></a>
    <a href="#license">
        <img src="https://img.shields.io/badge/license-AGPL-0?style=flat-square&labelcolor=202b2d&color=4a5568" alt="License"></a>
    <a href="https://github.com/welpo/git-sumi">
        <img src="https://img.shields.io/badge/clean_commits-git--sumi-0?style=flat-square&labelcolor=202b2d&color=4a5568" alt="clean commits"></a>
    <br>
    <br>
    <a href="https://calculator.osc.garden">
        <img src="screenshot.png" alt="A/B Sample Size & Duration Calculator Screenshot" width="600">
        </a>
    <br>
    <a href="https://calculator.osc.garden">Try it out!</a>
    <br>
</p>

<h3 align="center">Plan your A/B tests with confidence</h3>

## Features

- **Validated**: Implements standard, peer-reviewed formulas for clinical trial design, validated against established R packages like [`epiR`](https://cran.r-project.org/web/packages/epiR/index.html) (Stevenson & Sergeant, 2025) and [`TrialSize`](https://cran.r-project.org/web/packages/TrialSize/index.html) (Zhang et al., 2024)
- **Four test types**: superiority (one-tailed), two-tailed, non-inferiority, and equivalence
- **Duration estimation**: Calculate how long your experiment needs to run
- **MDE estimation**: Given a number of days, see what effect you could detect
- **Table with multiple values**: Compare different MDE or duration scenarios to evaluate test sensitivity vs. duration tradeoffs
- **Multiple variants**: Plan tests with up to 5 variants (A/B/C/D/E) (need more? [open an issue](https://github.com/welpo/ab-test-calculator/issues/new?&labels=feature))
- **Flexible MDE options**: Calculate for relative (percentage) or absolute (percentage point) improvements
- **Advanced settings**: Configure significance level, statistical power, test type, multiple testing corrections…
- **Traffic distribution**: Set custom traffic allocation between variants
- **Shareable plans**: Generate links to share test plans with colleagues, or download the tables as CSV
- **Private**: Works entirely client-side with no data sent to any server

## Contributing

Please do! I'd appreciate bug reports, improvements (however minor), suggestions…

The calculator uses vanilla JavaScript, HTML, and CSS. To run locally:

1. Clone the repository: `git clone https://github.com/welpo/ab-test-calculator.git`
2. Navigate to the project directory: `cd ab-test-calculator`
3. Start a local server: `python3 -m http.server`
4. Visit `http://localhost:8000` in your browser

The important files are:

- `index.html`: Basic structure
- `styles.css`: Styles
- `app.js`: Main logic
- `statistics.js`: Statistical functions
- `tests.js`: Tests, generated with the Python and R scripts in `test_generation/`. Add `?test` to the URL to run validation tests

## Need help?

Something not working? Have an idea? Let me know!

- Questions or ideas → [Start a discussion](https://github.com/welpo/ab-test-calculator/discussions)
- Found a bug? → [Report it here](https://github.com/welpo/ab-test-calculator/issues/new?&labels=bug)
- Feature request? → [Let me know](https://github.com/welpo/ab-test-calculator/issues/new?&labels=feature)

## License

This A/B test calculator is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License as published by the Free Software Foundation](./COPYING), either version 3 of the License, or (at your option) any later version.
