import Joi from 'joi'
import { colorScale } from '../color-formatters.js'
import { NotFound, pathParams } from '../index.js'
import ScrutinizerBase from './scrutinizer-base.js'

const schema = Joi.object({
  default_branch: Joi.string().required(),
  applications: Joi.object()
    .pattern(
      /^/,
      Joi.object({
        index: Joi.object({
          _embedded: Joi.object({
            project: Joi.object({
              metric_values: Joi.object({
                'scrutinizer.test_coverage': Joi.number().positive(),
              }).required(),
            }).required(),
          }).required(),
        }),
      }),
    )
    .required(),
}).required()

// https://scrutinizer-ci.com/g/filp/whoops/code-structure/master/code-coverage
// < 40% - red
// 40-60% (inclusive) - yellow
// > 60% brightgreen
const scale = colorScale([40, 61], ['red', 'yellow', 'brightgreen'])

class ScrutinizerCoverageBase extends ScrutinizerBase {
  static category = 'coverage'

  static defaultBadgeData = {
    label: 'coverage',
  }

  static render({ coverage }) {
    return {
      message: `${coverage.toFixed(0)}%`,
      color: scale(coverage),
    }
  }

  transform({ json, branch }) {
    const { value: rawCoverage } = this.transformBranchInfoMetricValue({
      json,
      branch,
      metric: 'scrutinizer.test_coverage',
    })

    if (!rawCoverage) {
      throw new NotFound({ prettyMessage: 'coverage not found' })
    }

    return { coverage: rawCoverage * 100 }
  }

  async makeBadge({ vcs, slug, branch }) {
    const json = await this.fetch({ schema, vcs, slug })
    const { coverage } = this.transform({ json, branch })
    return this.constructor.render({ coverage })
  }
}

class ScrutinizerCoverage extends ScrutinizerCoverageBase {
  static route = {
    base: 'scrutinizer/coverage',
    pattern: ':vcs(g|b)/:user/:repo/:branch*',
  }

  static openApi = {
    '/scrutinizer/coverage/{vcs}/{user}/{repo}': {
      get: {
        summary: 'Scrutinizer coverage (GitHub/Bitbucket)',
        parameters: pathParams(
          {
            name: 'vcs',
            example: 'g',
            description: 'Platform: Either GitHub or Bitbucket',
            schema: { type: 'string', enum: this.getEnum('vcs') },
          },
          { name: 'user', example: 'filp' },
          { name: 'repo', example: 'whoops' },
        ),
      },
    },
    '/scrutinizer/coverage/{vcs}/{user}/{repo}/{branch}': {
      get: {
        summary: 'Scrutinizer coverage (GitHub/Bitbucket) with branch',
        parameters: pathParams(
          {
            name: 'vcs',
            example: 'g',
            description: 'Platform: Either GitHub or Bitbucket',
            schema: { type: 'string', enum: this.getEnum('vcs') },
          },
          { name: 'user', example: 'filp' },
          { name: 'repo', example: 'whoops' },
          { name: 'branch', example: 'master' },
        ),
      },
    },
  }

  async handle({ vcs, user, repo, branch }) {
    return this.makeBadge({
      vcs,
      slug: `${user}/${repo}`,
      branch,
    })
  }
}

class ScrutinizerCoverageGitLab extends ScrutinizerCoverageBase {
  static route = {
    base: 'scrutinizer/coverage/gl',
    pattern: ':instance/:user/:repo/:branch*',
  }

  // There are no known anonymous accessible Scrutinizer reports available for GitLab repos.
  // The example used is valid, but the project will not be accessible if Shields users try to use it.
  // https://gitlab.propertywindow.nl/propertywindow/client
  // https://scrutinizer-ci.com/gl/propertywindow/propertywindow/client/badges/quality-score.png?b=master&s=dfae6992a48184cc2333b4c349cec0447f0d67c2
  static openApi = {
    '/scrutinizer/coverage/gl/{instance}/{user}/{repo}': {
      get: {
        summary: 'Scrutinizer coverage (GitLab)',
        parameters: pathParams(
          { name: 'instance', example: 'propertywindow' },
          { name: 'user', example: 'propertywindow' },
          { name: 'repo', example: 'client' },
        ),
      },
    },
    '/scrutinizer/coverage/gl/{instance}/{user}/{repo}/{branch}': {
      get: {
        summary: 'Scrutinizer coverage (GitLab) with branch',
        parameters: pathParams(
          { name: 'instance', example: 'propertywindow' },
          { name: 'user', example: 'propertywindow' },
          { name: 'repo', example: 'client' },
          { name: 'branch', example: 'master' },
        ),
      },
    },
  }

  async handle({ instance, user, repo, branch }) {
    return this.makeBadge({
      vcs: 'gl',
      slug: `${instance}/${user}/${repo}`,
      branch,
    })
  }
}

class ScrutinizerCoveragePlainGit extends ScrutinizerCoverageBase {
  static route = {
    base: 'scrutinizer/coverage/gp',
    pattern: ':slug/:branch*',
  }

  async handle({ slug, branch }) {
    return this.makeBadge({ vcs: 'gp', slug, branch })
  }
}

export {
  ScrutinizerCoverage,
  ScrutinizerCoverageGitLab,
  ScrutinizerCoveragePlainGit,
}
