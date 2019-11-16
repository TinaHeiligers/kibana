/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import Joi from 'joi';
import { schema } from '@kbn/config-schema';

const PARAM_TYPES = {
  NUMBER: 'number',
  STRING: 'string',
};

const TUTORIAL_CATEGORY = {
  LOGGING: 'logging',
  SIEM: 'siem',
  METRICS: 'metrics',
  OTHER: 'other',
};

// const dashboardSchema = schema.object({
//   id: schema.string(), // Dashboard saved object id
//   linkLabel: Joi.string().when('isOverview', {
//     is: true,
//     then: Joi.required(),
//   }),
//   // Is this an Overview / Entry Point dashboard?
//   isOverview: schema.boolean(),
// });

const artifactsSchema = schema.object({
  // Fields present in Elasticsearch documents created by this product.
  exportedFields: schema.object({
    documentationUrl: schema.string(),
  }),
  // Kibana dashboards created by this product.
  dashboards: schema.arrayOf(
    schema.object({
      id: schema.string(), // Dashboard saved object id
      linkLabel: schema.conditional(
        // linkLabel is required and must be a string when 'isOverview' has a value of true
        schema.siblingRef('isOverview'),
        true,
        schema.string(),
        schema.boolean()
      ),
      isOverview: schema.boolean(),
    })
  ),
  application: schema.object({
    path: schema.string(),
    label: schema.string(),
  }),
});

const statusCheckSchema = schema.object({
  title: schema.string(),
  text: schema.string(),
  btnLabel: schema.string(),
  success: schema.string(),
  error: schema.string(),
  esHitsCheck: schema.object({
    // index: either a string or an array of strings
    index: schema.oneOf([schema.string(), schema.arrayOf(schema.string())]),
    // .try(Joi.string(), Joi.array().items(Joi.string()))
    // .required(),
    query: joi.object(),
  }),
});
/*
One of:

query: {
  match_all: {},
},

query: {
  bool: {
    filter: {
      term: {
        'agent.type': 'auditbeat',
      },
    },
  },
},
query: {
  bool: {
    filter: [
      { term: { 'processor.event': 'onboarding' } },
      { range: { 'observer.version_major': { gte: 7 } } },
    ],
  },
},
*/

const instructionSchema = schema.object({
  title: schema.string(),
  textPre: schema.string(),
  commands: schema.arrayOf(schema.maybe(schema.oneOf([schema.maybe(schema.string())]))),
  textPost: schema.string(),
});

const instructionVariantSchema = schema.object({
  id: schema.string(),
  instructions: Joi.array()
    .items(instructionSchema)
    .required(),
});

const instructionSetSchema = schema.object({
  title: schema.string(),
  callOut: schema.object({
    title: schema.string(),
    message: schema.string(),
    iconType: schema.string(),
  }),
  // Variants (OSes, languages, etc.) for which tutorial instructions are specified.
  instructionVariants: Joi.array()
    .items(instructionVariantSchema)
    .required(),
  statusCheck: statusCheckSchema,
});

const paramSchema = schema.object({
  defaultValue: Joi.required(),
  id: Joi.string()
    .regex(/^[a-zA-Z_]+$/)
    .required(),
  label: schema.string(),
  type: Joi.string()
    .valid(Object.values(PARAM_TYPES))
    .required(),
});

const instructionsSchema = schema.object({
  instructionSets: Joi.array()
    .items(instructionSetSchema)
    .required(),
  params: Joi.array().items(paramSchema),
});

export const tutorialSchema = {
  id: Joi.string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .required(),
  category: Joi.string()
    .valid(Object.values(TUTORIAL_CATEGORY))
    .required(),
  name: schema.string(),
  isBeta: schema.boolean({ defaultValue: false }),
  shortDescription: schema.string(),
  euiIconType: schema.string(), // EUI icon type string, one of https://elastic.github.io/eui/#/icons
  longDescription: schema.string(),
  completionTimeMinutes: schema.number(),
  previewImagePath: schema.string(),

  // kibana and elastic cluster running on prem
  onPrem: instructionsSchema.required(),

  // kibana and elastic cluster running in elastic's cloud
  elasticCloud: instructionsSchema,

  // kibana running on prem and elastic cluster running in elastic's cloud
  onPremElasticCloud: instructionsSchema,

  // Elastic stack artifacts produced by product when it is setup and run.
  artifacts: artifactsSchema,

  // saved objects used by data module.
  savedObjects: Joi.array().items(),
  savedObjectsInstallMsg: schema.string(),
};
