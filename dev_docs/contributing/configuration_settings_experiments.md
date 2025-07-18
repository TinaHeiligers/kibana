---
id: kibDevConfigExp
slug: /kibana-dev-docs/contributing/config-settings-experiments
title: Guidelines for configuration settings and experimentation in Kibana
description: Follow our development principles to help keep our code base stable, maintainable and scalable.
date: 2025-07-02
tags: ['kibana', 'onboarding', 'dev', 'configuration', 'experiments']
---


Summary
The purpose of this document is to clarify for Application developers when and how to use various platform mechanisms that enable/show different experiences in the UI for different customers and users. We describe the existing mechanisms and then cover the following use cases:
Setting up for development in the main branch without leaking unfinished work to users (jump to this section)
Providing configuration options for system administrators in (jump to that section)
Serverless
Cloud Hosted
On-prem
Feature development, testing, and incremental rollout (jump to the section)

We briefly touch on providing user-friendly configuration options.
 
The following are out of scope
Configuration of capabilities based on privileges (see Designing feature priviliges )
Definition of tech preview and process for technical preview (see <discussion>)
Configuration of other components of the platform other than Kibana

Available mechanisms
Kibana startup configuration (kibana.yml)
The Kibana server reads properties from the kibana.yml file on startup. Modifying these settings is one of the ways to change the behavior of the Kibana instance.

In on-prem deployments, customers have full control over the kibana.yml and are able to override all settings (documented and not).

In Cloud-hosted (ECH), customers cannot edit kibana.yml directly. Any configuration we want to allow has to be exposed either as Kibana advanced settings (see below) or in the Cloud UI (under "Edit deployment" --> Kibana instance --> "Edit user settings"). Default kibana.yml used in ECH is defined in cloud stackpacks, with some programmatic configurations applied here. The subset of settings that are editable by the user in cloud ui is defined here. More information in How to modify settings listed and  Elastic stack configuration settings documentation.

In Serverless environments, customers cannot edit kibana configuration. We have a hierarchical system for defining settings that allows for differences per project type and product tier. See more in Serverless configuration details

Note that `kibana.yml` is the only platform mechanism that supports sensitive configuration values. Advanced Settings do not support encryption today, and aren't suitable for storing secrets or other sensitive information (issue). 
Kibana Advanced settings
Advanced Settings give authorized users (typically cluster/project administrators) ability to control the behavior of Kibana. Advanced settings can be either space-specific or global. The same set of Advanced settings is available in on-prem deployments and  Cloud-hosted.  Serverless exposes a different set, some shared with hosted, some specific to Serverless. See Serverless advanced settings for more details.

In order to define an advanced setting, application needs to register their setting with core's server-side uiSettings service. 
See more in Defining Advanced Settings

Feature flagging service (using Launchdarkly)
The Feature flagging service provides a way for application developers to allow for real-time configuration of the platform functionality. It is best suited for
Phased rollout of features (either to a specific customer, a subset of customers, or a % of overall users) (Rollout flags)
Feature experimentation using A/B tests and other approaches

Feature flagging service can also be used for feature development in main (see below).

Feature flagging is NOT suitable for
Applying feature availability for licensing and/or tiers
Restricting access or applying customer entitlement to specific GA features
Functionality that requires a server restart

User Preferences
Today Cloud and Kibana provide very limited user preferences. Users who do not have admin access can only configure their name and view settings (dark mode). Over the time we have tried several approaches to allow users to choose their experience, but none are supported today.

Recommended implementation approaches
Developing features in main 
The main branch must always be release-able. This means we must protect the main branch from code that is not ready for production.  When developing new features, especially large features, we have two well-known methods for protecting the main branch, and production: feature branches and feature flags. Generally we should default to rolling out new features behind flags, though there may be some circumstances where developing in a feature branch is appropriate.
Feature branches keep all code that isn’t ready completely separate from the main branch.  This may be needed for efforts that involve lots of contributors, like ES|QL.
Pros: code is kept completely separate, can be demoed easily, lots of developers can open pulls against it, review is easier.
Cons: we can’t see the feature in production environments, code must be rebased often.  Phased roll-out or A/B testing requires more work, (if it’s even possible).
This approach is recommended for larger development projects that need to be released as a big bang.
Feature flags, by contrast, allow you to merge code to the main branch, but prevent it from running in production by default.  They work best for features that take a long time to develop, or those you want to refine and release in phases. 
Pros: PRs are clean and small, easy to review, progress is seen and demonstrated easily, phasing is simpler.  Phased roll-out and A/B tests are built-in.
Cons: extra care must be taken with testing, feature flags must be monitored and groomed, mistakes and bugs are more likely, feature flag checks can overwhelm other logic.
This approach is recommended for features that we want to enable for a subset of customers or roll out incrementally.

The recommended way to implement feature flags is using the Feature flagging service, with the default state set to disabled. That supports our Cloud-first development preference and avoids creating transitory settings that users can use incorrectly.
See also Incremental feature rollout.

Regardless of whether you use flags or branches, it is critical that you have adequate test coverage before anything merges to main - this includes automated tests for both enabled and disabled states, manual validation performed during development as well as scale and security assessments.
Providing configuration options for system administrators
If configuration must be applied at startup or requires restart
To make it available in Stateful (On-prem,  Cloud-hosted),
Expose the configuration in kibana.yml 
Add it to the allowlist in the Cloud UI for  Cloud-hosted
In Serverless it is not possible to have a customizable configuration requiring restart.

If configuration needs to be available to a broader set of users and can be applied while kibana is running, expose it in the Advanced settings
The only way to allow configuration options in Serverless environments is via Advanced settings - it is not possible to have a configuration requiring restart.
Incremental feature rollout 
Incremental feature rollout is only possible in Cloud-hosted and Serverless environments, using the Feature flagging service.
To do this, 
During development, the feature is hidden behind a feature flag (with a default of `hidden` to ensure feature is not accidentally exposed) 
When it's time to release it, we can roll it out progressively by targeting a subset of users/organizations (see segmentation examples for some ideas of how rollout can be staged)
Once the feature is enabled in 100% of deployments, change the code to make the feature enabled by default and remove the flag entirely.
Feature experimentation & A/B testing
In Cloud-hosted and Serverless environments, use Feature flagging service
It is recommended to do experimentation in the cloud, but if on-prem experiments are required, the approach is to create an Advanced setting or kibana.yml setting and share the information about configuration with select customers to allow them to test a pre-release feature.

Beyond Kibana
So far the document focused on configuration specified in Kibana. Sometimes, Elasticsearch will need to be the source of truth for the feature configuration. One common example of this is checking if ML is enabled in the cluster/project or validating which ES|QL commands can be used. See this discussion for some examples and context. 

Related content/sources
Defining advanced settings
Serverless configuration details

How to register a new advanced setting: https://docs.elastic.dev/kibana-dev-docs/tutorials/advanced-settings 
Searching advanced settings: https://github.com/elastic/kibana-team/issues/1018 
Developing best practices for FF discussion: https://github.com/elastic/kibana-team/issues/312 
Feature flagging service documentation: https://docs.elastic.dev/kibana-dev-docs/tutorials/feature-flags-service 
Adv settings across spaces: https://github.com/elastic/kibana/issues/115601
yml configs & ffs in serverless Serverless cheat sheet for Kibana developers
Serverless settings allowlist https://github.com/elastic/kibana/pull/164471 
Hierarchical configuration in Serverless https://github.com/elastic/kibana/blob/main/config/README.md 
July 2023 - thoughts on feature flags & feature branches in Kibana
