/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import Semver from 'semver';
import type { SavedObjectsType } from '@kbn/core-saved-objects-server';
import { assertValidModelVersion, modelVersionToVirtualVersion } from './conversion';

/**
 * Represents the virtual version of a given SO type.
 * The virtual version is a compatibility format between the old
 * migration system's versioning, based on the stack version, and the new model versioning.
 *
 * A virtual version is a plain semver version. Depending on its major version value, the
 * underlying version can be the following:
 * - Major < 10: Old migrations system (stack versions), using the equivalent value (e.g `8.7.0` => migration version `8.7.0`)
 * - Major == 10: Model versions, using the `10.{modelVersion}.0` format (e.g `10.3.0` => model version 3)
 */
export type VirtualVersion = string;

/**
 * A map of SO type name to Model Version.
 */
export type ModelVersionMap = Record<string, number>;

/**
 * A map of SO type name to {@link VirtualVersion}.
 */
export type VirtualVersionMap = Record<string, VirtualVersion>;
export interface InternalSavedObjectsType extends SavedObjectsType {
  /**
   * Allows to opt-in to the model version API.
   *
   * Must be a valid semver version (with the patch version being necessarily 0)
   *
   * When specified, the type will switch from using the {@link SavedObjectsType.migrations | legacy migration API}
   * to use the {@link SavedObjectsType.modelVersions | modelVersion API} after the specified version.
   *
   * Once opted in, it will no longer be possible to use the legacy migration API after the specified version.
   *
   * @example A **valid** usage example would be:
   *
   * ```ts
   * {
   *   name: 'foo',
   *   // other mandatory attributes...
   *   switchToModelVersionAt: '8.8.0',
   *   migrations: {
   *     '8.1.0': migrateTo810,
   *     '8.7.0': migrateTo870,
   *   },
   *   modelVersions: {
   *     '1': modelVersion1
   *   }
   * }
   * ```
   *
   * @example An **invalid** usage example would be:
   *
   * ```ts
   * {
   *   name: 'foo',
   *   // other mandatory attributes...
   *   switchToModelVersionAt: '8.9.0',
   *   migrations: {
   *     '8.1.0': migrateTo8_1,
   *     '8.9.0': migrateTo8_9, // error: migration registered for the switch version
   *     '8.10.0': migrateTo8_10, // error: migration registered for after the switch version
   *   },
   *   modelVersions: {
   *     '1': modelVersion1
   *   }
   * }
   * ```
   *
   * Please refer to the {@link SavedObjectsType.modelVersions | modelVersion API} for more documentation on
   * the new API.
   *
   * @remarks All types will be forced to switch to use the new API during `8.10.0`. This switch is
   *          allowing types owners to switch their types before the milestone (and for testing purposes).
   */
  switchToModelVersionAt?: string;
}
/**
 * Returns the latest registered model version number for the given type.
 */
export const getLatestModelVersion = (type: InternalSavedObjectsType): number => {
  const versionMap =
    typeof type.modelVersions === 'function' ? type.modelVersions() : type.modelVersions ?? {};
  return Object.keys(versionMap).reduce<number>((memo, current) => {
    return Math.max(memo, assertValidModelVersion(current));
  }, 0);
};

export const getLatestMigrationVersion = (type: InternalSavedObjectsType): string => {
  const migrationMap =
    typeof type.migrations === 'function' ? type.migrations() : type.migrations ?? {};
  return Object.keys(migrationMap).reduce<string>((memo, current) => {
    return Semver.gt(memo, current) ? memo : current;
  }, '0.0.0');
};

/**
 * Build a version map for the given types.
 */
export const getModelVersionMapForTypes = (types: InternalSavedObjectsType[]): ModelVersionMap => {
  return types.reduce<ModelVersionMap>((versionMap, type) => {
    versionMap[type.name] = getLatestModelVersion(type);
    return versionMap;
  }, {});
};

/**
 * Returns the current virtual version for the given type.
 * It will either be the latest model version if the type
 * already switched to using them (switchToModelVersionAt is set),
 * or the latest migration version for the type otherwise.
 */
export const getCurrentVirtualVersion = (type: InternalSavedObjectsType): string => {
  if (type.switchToModelVersionAt) {
    const modelVersion = getLatestModelVersion(type);
    return modelVersionToVirtualVersion(modelVersion);
  } else {
    return getLatestMigrationVersion(type);
  }
};

/**
 * Returns a map of virtual model version for the given types.
 * See {@link getCurrentVirtualVersion}
 */
export const getVirtualVersionMap = (types: InternalSavedObjectsType[]): VirtualVersionMap => {
  return types.reduce<VirtualVersionMap>((versionMap, type) => {
    versionMap[type.name] = getCurrentVirtualVersion(type);
    return versionMap;
  }, {});
};

/**
 * Returns the latest version number that includes changes in the mappings, for the given type.
 * If none of the versions are updating the mappings, it will return 0
 */
export const getLatestMappingsVersionNumber = (type: InternalSavedObjectsType): number => {
  const versionMap =
    typeof type.modelVersions === 'function' ? type.modelVersions() : type.modelVersions ?? {};
  return Object.entries(versionMap)
    .filter(([version, info]) =>
      info.changes?.some((change) => change.type === 'mappings_addition')
    )
    .reduce<number>((memo, [current]) => {
      return Math.max(memo, assertValidModelVersion(current));
    }, 0);
};

/**
 * Returns the latest model version that includes changes in the mappings, for the given type.
 * It will either be a model version if the type
 * already switched to using them (switchToModelVersionAt is set),
 * or the latest migration version for the type otherwise.
 */
export const getLatestMappingsModelVersion = (type: InternalSavedObjectsType): string => {
  if (type.switchToModelVersionAt) {
    const modelVersion = getLatestMappingsVersionNumber(type);
    return modelVersionToVirtualVersion(modelVersion);
  } else {
    return getLatestMigrationVersion(type);
  }
};

/**
 * Returns a map of virtual model version for the given types.
 * See {@link getLatestMappingsModelVersion}
 */
export const getLatestMappingsVirtualVersionMap = (
  types: InternalSavedObjectsType[]
): VirtualVersionMap => {
  return types.reduce<VirtualVersionMap>((versionMap, type) => {
    versionMap[type.name] = getLatestMappingsModelVersion(type);
    return versionMap;
  }, {});
};
