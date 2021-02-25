/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { fieldDescriptions } from './core_usage_collection_schema_descriptions';

export const coreUsageCollectorSchema = {
  config: {
    elasticsearch: {
      sniffOnStart: { type: 'boolean' },
      sniffIntervalMs: { type: 'long' },
      sniffOnConnectionFault: { type: 'boolean' },
      numberOfHostsConfigured: { type: 'long' },
      requestHeadersWhitelistConfigured: { type: 'boolean' },
      customHeadersConfigured: { type: 'boolean' },
      shardTimeoutMs: { type: 'long' },
      requestTimeoutMs: { type: 'long' },
      pingTimeoutMs: { type: 'long' },
      logQueries: { type: 'boolean' },
      ssl: {
        verificationMode: { type: 'keyword' },
        certificateAuthoritiesConfigured: { type: 'boolean' },
        certificateConfigured: { type: 'boolean' },
        keyConfigured: { type: 'boolean' },
        keystoreConfigured: { type: 'boolean' },
        truststoreConfigured: { type: 'boolean' },
        alwaysPresentCertificate: { type: 'boolean' },
      },
      apiVersion: { type: 'keyword' },
      healthCheckDelayMs: { type: 'long' },
    },

    http: {
      basePathConfigured: { type: 'boolean' },
      maxPayloadInBytes: { type: 'long' },
      rewriteBasePath: { type: 'boolean' },
      keepaliveTimeout: { type: 'long' },
      socketTimeout: { type: 'long' },
      compression: {
        enabled: { type: 'boolean' },
        referrerWhitelistConfigured: { type: 'boolean' },
      },
      xsrf: {
        disableProtection: { type: 'boolean' },
        allowlistConfigured: { type: 'boolean' },
      },
      requestId: {
        allowFromAnyIp: { type: 'boolean' },
        ipAllowlistConfigured: { type: 'boolean' },
      },
      ssl: {
        certificateAuthoritiesConfigured: { type: 'boolean' },
        certificateConfigured: { type: 'boolean' },
        cipherSuites: { type: 'array', items: { type: 'keyword' } },
        keyConfigured: { type: 'boolean' },
        keystoreConfigured: { type: 'boolean' },
        truststoreConfigured: { type: 'boolean' },
        redirectHttpFromPortConfigured: { type: 'boolean' },
        supportedProtocols: { type: 'array', items: { type: 'keyword' } },
        clientAuthentication: { type: 'keyword' },
      },
    },

    logging: {
      appendersTypesUsed: { type: 'array', items: { type: 'keyword' } },
      loggersConfiguredCount: { type: 'long' },
    },

    savedObjects: {
      customIndex: { type: 'boolean' },
      maxImportPayloadBytes: { type: 'long' },
      maxImportExportSizeBytes: { type: 'long' },
    },
  },
  environment: {
    memory: {
      heapSizeLimit: { type: 'long' },
      heapTotalBytes: { type: 'long' },
      heapUsedBytes: { type: 'long' },
    },
  },
  services: {
    savedObjects: {
      indices: {
        type: 'array',
        items: {
          docsCount: { type: 'long' },
          docsDeleted: { type: 'long' },
          alias: { type: 'keyword' },
          primaryStoreSizeBytes: { type: 'long' },
          storeSizeBytes: { type: 'long' },
        },
      },
    },
  },
  // Saved Objects Client APIs
  'apiCalls.savedObjectsBulkCreate.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.total'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.default.total'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.custom.total'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsBulkGet.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.total'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.default.total'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.custom.total'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsBulkUpdate.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.total'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.default.total'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.custom.total'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsCreate.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.total'],
  },
  'apiCalls.savedObjectsCreate.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.default.total'],
  },
  'apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsCreate.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.custom.total'],
  },
  'apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsDelete.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.total'],
  },
  'apiCalls.savedObjectsDelete.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.default.total'],
  },
  'apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsDelete.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.custom.total'],
  },
  'apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsFind.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.total'],
  },
  'apiCalls.savedObjectsFind.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.default.total'],
  },
  'apiCalls.savedObjectsFind.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsFind.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsFind.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.custom.total'],
  },
  'apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsGet.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.total'],
  },
  'apiCalls.savedObjectsGet.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.default.total'],
  },
  'apiCalls.savedObjectsGet.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsGet.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsGet.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.custom.total'],
  },
  'apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsResolve.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.total'],
  },
  'apiCalls.savedObjectsResolve.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.default.total'],
  },
  'apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsResolve.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.custom.total'],
  },
  'apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsUpdate.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.total'],
  },
  'apiCalls.savedObjectsUpdate.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.default.total'],
  },
  'apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsUpdate.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.custom.total'],
  },
  'apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.no'],
  },
  // Saved Objects Management APIs
  'apiCalls.savedObjectsImport.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.total'],
  },
  'apiCalls.savedObjectsImport.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.default.total'],
  },
  'apiCalls.savedObjectsImport.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsImport.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsImport.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.custom.total'],
  },
  'apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsImport.createNewCopiesEnabled.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.createNewCopiesEnabled.yes'],
  },
  'apiCalls.savedObjectsImport.createNewCopiesEnabled.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.createNewCopiesEnabled.no'],
  },
  'apiCalls.savedObjectsImport.overwriteEnabled.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.overwriteEnabled.yes'],
  },
  'apiCalls.savedObjectsImport.overwriteEnabled.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsImport.overwriteEnabled.no'],
  },
  'apiCalls.savedObjectsResolveImportErrors.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolveImportErrors.total'],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolveImportErrors.namespace.default.total'],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions[
      'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.yes'
    ],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions[
      'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.no'
    ],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolveImportErrors.namespace.custom.total'],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions[
      'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.yes'
    ],
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions[
      'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.no'
    ],
  },
  'apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.yes'],
  },
  'apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.no'],
  },
  'apiCalls.savedObjectsExport.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.total'],
  },
  'apiCalls.savedObjectsExport.namespace.default.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.default.total'],
  },
  'apiCalls.savedObjectsExport.namespace.default.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.default.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsExport.namespace.default.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.default.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsExport.namespace.custom.total': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.custom.total'],
  },
  'apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.yes'],
  },
  'apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.no'],
  },
  'apiCalls.savedObjectsExport.allTypesSelected.yes': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.allTypesSelected.yes'],
  },
  'apiCalls.savedObjectsExport.allTypesSelected.no': {
    type: 'long',
    ...fieldDescriptions['apiCalls.savedObjectsExport.allTypesSelected.no'],
  },
};
