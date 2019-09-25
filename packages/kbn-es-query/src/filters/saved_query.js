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
import dateMath from '@elastic/datemath';

export function buildSavedQueryFilter(savedQuery) {
  const filter = {
    meta: {
      type: 'savedQuery',
      key: savedQuery.id,
      params: { savedQuery }
    }
  };
  return filter;
}

// note that I added this after the meeting had ended, it was just an empty function. Check video recording
export function compareSavedQueryFilter(first, second) {
  return (first.meta.key === second.meta.key);
}

// copying getTime from src/legacy/core_plugins/data/public/timefilter/get_time.ts without types or forceNow
export function calculateBounds(timeRange) {
  return {
    min: dateMath.parse(timeRange.from),
    max: dateMath.parse(timeRange.to, { roundUp: true }),
  };
}

export function getTime(
  indexPattern,
  timeRange,
) {
  if (!indexPattern) {
    // in CI, we sometimes seem to fail here.
    return;
  }

  const timefield = indexPattern.fields.find(
    field => field.name === indexPattern.timeFieldName
  );

  if (!timefield) {
    return;
  }

  const bounds = calculateBounds(timeRange);
  if (!bounds) {
    return;
  }
  const filter = {
    range: { [timefield.name]: { format: 'strict_date_optional_time' } },
  };

  if (bounds.min) {
    filter.range[timefield.name].gte = bounds.min.toISOString();
  }

  if (bounds.max) {
    filter.range[timefield.name].lte = bounds.max.toISOString();
  }

  return filter;
}

