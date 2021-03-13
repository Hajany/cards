/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package ca.sickkids.ccm.lfs.vocabularies.internal;

import javax.jcr.Node;

import org.apache.commons.lang3.StringUtils;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.FieldOption;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ReferenceCardinality;
import org.osgi.service.component.annotations.ReferencePolicyOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ca.sickkids.ccm.lfs.vocabularies.BioPortalApiKeyManager;

/**
 * A component that provide access to BioPortal API key through node or environment.
 *
 * @version $Id$
 */
@Component
public class DefaultBioPortalApiKeyManager implements BioPortalApiKeyManager
{
    /** OS environment variable which has the api key for bioontology portal. */
    private static final String APIKEY_ENVIRONMENT_VARIABLE = "BIOPORTAL_APIKEY";

    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultBioPortalApiKeyManager.class);

    @Reference(fieldOption = FieldOption.REPLACE, cardinality = ReferenceCardinality.OPTIONAL,
            policyOption = ReferencePolicyOption.GREEDY)
    private ResourceResolverFactory rrf;

    @Override
    public String getAPIKey()
    {
        String key = this.getAPIKeyFromNode();
        if ("".equals(key)) {
            // if node does not exist, get api key from env variable
            key = this.getAPIKeyFromEnvironment();
        }
        return key;
    }

    @Override
    public String getAPIKeyFromEnvironment()
    {
        String apiKey = System.getenv(APIKEY_ENVIRONMENT_VARIABLE);
        apiKey = StringUtils.isBlank(apiKey) ? "" : apiKey;
        LOGGER.info("BioPortal API key as set in the OS environment: [{}]", apiKey);
        return apiKey;
    }

    @Override
    public String getAPIKeyFromNode()
    {
        String resourcePath = "/libs/lfs/conf/BioportalApiKey";
        String apiKey = "";

        try {
            Resource res = this.rrf.getThreadResourceResolver().getResource(resourcePath);
            Node keyNode = res.adaptTo(Node.class);
            apiKey = keyNode.getProperty("key").getString();
            LOGGER.info("BioPortal API key as set in the BioportalApiKey node: [{}]", apiKey);
        } catch (Exception e) {
            LOGGER.error("Failed to load BioPortal API key from node: {}", e.getMessage(), e);
        }
        return apiKey;
    }
}
