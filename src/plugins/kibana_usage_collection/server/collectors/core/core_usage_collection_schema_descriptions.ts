/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
export const fieldDescriptions = {
  'config.elasticsearch.sniffOnStart': '',
  'config.elasticsearch.sniffIntervalMs': '',
  'config.elasticsearch.sniffOnConnectionFault': '',
  'config.elasticsearch.numberOfHostsConfigured': '',
  'config.elasticsearch.requestHeadersWhitelistConfigured': '',
  'config.elasticsearch.customHeadersConfigured': '',
  'config.elasticsearch.shardTimeoutMs': '',
  'config.elasticsearch.requestTimeoutMs': '',
  'config.elasticsearch.pingTimeoutMs': '',
  'config.elasticsearch.logQueries': '',
  'config.elasticsearch.ssl.verificationMode': '',
  'config.elasticsearch.ssl.certificateAuthoritiesConfigured': '',
  'config.elasticsearch.ssl.certificateConfigured': '',
  'config.elasticsearch.ssl.keyConfigured': '',
  'config.elasticsearch.ssl.keystoreConfigured': '',
  'config.elasticsearch.ssl.truststoreConfigured': '',
  'config.elasticsearch.ssl.alwaysPresentCertificate': '',
  'config.elasticsearch.apiVersion': '',
  'config.elasticsearch.healthCheckDelayMs': '',
  'config.http.basePathConfigured': '',
  'config.http.maxPayloadInBytes': '',
  'config.http.rewriteBasePath': '',
  'config.http.keepaliveTimeout': '',
  'config.http.socketTimeout': '',
  'config.http.compression.enabled': '',
  'config.http.compression.referrerWhitelistConfigured': '',
  'config.http.xsrf.disableProtection': '',
  'config.http.xsrf.allowlistConfigured': '',
  'config.http.requestId.allowFromAnyIp': '',
  'config.http.requestId.ipAllowlistConfigured': '',
  'config.http.ssl.certificateAuthoritiesConfigured': '',
  'config.http.ssl.certificateConfigured': '',
  'config.http.ssl.cipherSuites': '',
  'config.http.ssl.cipherSuites.items': '',
  'config.http.ssl.keyConfigured': '',
  'config.http.ssl.keystoreConfigured': '',
  'config.http.ssl.truststoreConfigured': '',
  'config.http.ssl.redirectHttpFromPortConfigured': '',
  'config.http.ssl.supportedProtocols': '',
  'config.http.ssl.supportedProtocols.items': '',
  'config.http.ssl.clientAuthentication': '',
  'config.logging.appendersTypesUsed': '',
  'config.logging.appendersTypesUsed.items': '',
  'config.logging.loggersConfiguredCount': '',
  'config.savedObjects.customIndex': '',
  'config.savedObjects.maxImportPayloadBytes': '',
  'config.savedObjects.maxImportExportSizeBytes': '',
  'environment.memory.heapSizeLimit': '',
  'environment.memory.heapTotalBytes': '',
  'environment.memory.heapUsedBytes': '',
  'services.savedObjects.indices': '',
  'services.savedObjects.indices.items.docsCount': '',
  'services.savedObjects.indices.items.docsDeleted': '',
  'services.savedObjects.indices.items.alias': '',
  'services.savedObjects.indices.items.primaryStoreSizeBytes': '',
  'services.savedObjects.indices.items.storeSizeBytes': '',
  'apiCalls.savedObjectsBulkCreate.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsBulkCreate.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkCreate.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkCreate.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsBulkCreate.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsBulkGet.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsBulkGet.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkGet.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkGet.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsBulkGet.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsBulkUpdate.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsBulkUpdate.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkUpdate.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsBulkUpdate.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsBulkUpdate.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsCreate.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsCreate.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsCreate.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsCreate.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsCreate.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsDelete.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsDelete.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsDelete.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsDelete.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsDelete.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsFind.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsFind.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsFind.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsFind.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsFind.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsFind.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsGet.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsGet.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsGet.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsGet.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsGet.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsGet.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsResolve.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsResolve.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsResolve.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsResolve.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsResolve.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsUpdate.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsUpdate.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsUpdate.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsUpdate.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsUpdate.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsImport.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsImport.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsImport.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsImport.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsImport.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsImport.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsImport.createNewCopiesEnabled.yes': {
    _meta: {
      description:
        'How many times this API has been called with the `createNewCopiesEnabled` option.',
    },
  },

  'apiCalls.savedObjectsImport.createNewCopiesEnabled.no': {
    _meta: {
      description:
        'How many times this API has been called without the `createNewCopiesEnabled` option.',
    },
  },

  'apiCalls.savedObjectsImport.overwriteEnabled.yes': {
    _meta: { description: 'How many times this API has been called with the `overwrite` option.' },
  },

  'apiCalls.savedObjectsImport.overwriteEnabled.no': {
    _meta: {
      description: 'How many times this API has been called without the `overwrite` option.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsResolveImportErrors.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.yes': {
    _meta: {
      description:
        'How many times this API has been called with the `createNewCopiesEnabled` option.',
    },
  },

  'apiCalls.savedObjectsResolveImportErrors.createNewCopiesEnabled.no': {
    _meta: {
      description:
        'How many times this API has been called without the `createNewCopiesEnabled` option.',
    },
  },

  'apiCalls.savedObjectsExport.total': {
    _meta: { description: 'How many times this API has been called.' },
  },
  'apiCalls.savedObjectsExport.namespace.default.total': {
    _meta: { description: 'How many times this API has been called in the Default space.' },
  },

  'apiCalls.savedObjectsExport.namespace.default.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsExport.namespace.default.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in the Default space.',
    },
  },

  'apiCalls.savedObjectsExport.namespace.custom.total': {
    _meta: { description: 'How many times this API has been called in a custom space.' },
  },

  'apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.yes': {
    _meta: {
      description:
        'How many times this API has been called by the Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsExport.namespace.custom.kibanaRequest.no': {
    _meta: {
      description:
        'How many times this API has been called by a non-Kibana client in a custom space.',
    },
  },

  'apiCalls.savedObjectsExport.allTypesSelected.yes': {
    _meta: {
      description:
        'How many times this API has been called with the `createNewCopiesEnabled` option.',
    },
  },

  'apiCalls.savedObjectsExport.allTypesSelected.no': {
    _meta: { description: 'How many times this API has been called without all types selected.' },
  },
};
