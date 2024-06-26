import Joi from 'joi'
import { colorScale } from '../color-formatters.js'
import { pathParams } from '../index.js'
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
                'scrutinizer.quality': Joi.number().positive(),
              }).required(),
            }).required(),
          }).required(),
        }),
      }),
    )
    .required(),
}).required()

const scale = colorScale(
  [4, 5, 7, 9],
  ['red', 'orange', 'yellow', 'green', 'brightgreen'],
)

class ScrutinizerQualityBase extends ScrutinizerBase {
  static category = 'analysis'

  static defaultBadgeData = {
    label: 'code quality',
  }

  static render({ score }) {
    return {
      message: `${Math.round(score * 100) / 100}`,
      color: scale(score),
    }
  }

  async makeBadge({ vcs, slug, branch }) {
    const json = await this.fetch({ schema, vcs, slug })
    const { value: score } = this.transformBranchInfoMetricValue({
      json,
      branch,
      metric: 'scrutinizer.quality',
    })
    return this.constructor.render({ score })
  }
}

class ScrutinizerQuality extends ScrutinizerQualityBase {
  static route = {
    base: 'scrutinizer/quality',
    pattern: ':vcs(g|b)/:user/:repo/:branch*',
  }

  static openApi = {
    '/scrutinizer/quality/{vcs}/{user}/{repo}': {
      get: {
        summary: 'Scrutinizer quality (GitHub/Bitbucket)',
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
    '/scrutinizer/quality/{vcs}/{user}/{repo}/{branch}': {
      get: {
        summary: 'Scrutinizer quality (GitHub/Bitbucket) with branch',
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

class ScrutinizerQualityGitLab extends ScrutinizerQualityBase {
  static route = {
    base: 'scrutinizer/quality/gl',
    pattern: ':instance/:user/:repo/:branch*',
  }

  // There are no known anonymous accessible Scrutinizer reports available for GitLab repos.
  // The example used is valid, but the project will not be accessible if Shields users try to use it.
  // https://gitlab.propertywindow.nl/propertywindow/client
  // https://scrutinizer-ci.com/gl/propertywindow/propertywindow/client/badges/quality-score.png?b=master&s=dfae6992a48184cc2333b4c349cec0447f0d67c2
  static openApi = {
    '/scrutinizer/quality/gl/{instance}/{user}/{repo}': {
      get: {
        summary: 'Scrutinizer quality (GitLab)',
        parameters: pathParams(
          { name: 'instance', example: 'propertywindow' },
          { name: 'user', example: 'propertywindow' },
          { name: 'repo', example: 'client' },
        ),
      },
    },
    '/scrutinizer/quality/gl/{instance}/{user}/{repo}/{branch}': {
      get: {
        summary: 'Scrutinizer quality (GitLab) with branch',
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

class ScrutinizerQualityPlainGit extends ScrutinizerQualityBase {
  static route = {
    base: 'scrutinizer/quality/gp',
    pattern: ':slug/:branch*',
  }

  async handle({ slug, branch }) {
    return this.makeBadge({ vcs: 'gp', slug, branch })
  }
}

export default [
  ScrutinizerQuality,
  ScrutinizerQualityGitLab,
  ScrutinizerQualityPlainGit,
]
