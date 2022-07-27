
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.uhndata.cards.forms.internal;

import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.jackrabbit.oak.api.CommitFailedException;
import org.apache.jackrabbit.oak.api.Type;
import org.apache.jackrabbit.oak.spi.commit.DefaultValidator;
import org.apache.jackrabbit.oak.spi.commit.Validator;
import org.apache.jackrabbit.oak.spi.state.NodeState;
import org.apache.sling.api.resource.LoginException;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;

public class RequiredSubjectTypesValidator extends DefaultValidator
{
    private final ResourceResolverFactory rrf;

    public RequiredSubjectTypesValidator(ResourceResolverFactory rrf)
    {
        this.rrf = rrf;
    }

    @Override
    public Validator childNodeAdded(String name, NodeState after) throws CommitFailedException
    {
        // Get the type of this node. Return immediately if it's not a cards:Form node
        final String childNodeType = after.getName("jcr:primaryType");
        if (!("cards:Form".equals(childNodeType))) {
            return this;
        }

        // Get the jcr:uuid values for the Form's associated Questionnaire and Subject
        final String questionnaireUUID = after.getProperty("questionnaire").getValue(Type.REFERENCE).toString();
        final String subjectUUID = after.getProperty("subject").getValue(Type.REFERENCE).toString();
        // Obtain a ResourceResolver for querying the JCR
        final Map<String, Object> parameters =
            Collections.singletonMap(ResourceResolverFactory.SUBSERVICE, "requiredSubjectTypesValidator");
        try (ResourceResolver serviceResolver = this.rrf.getServiceResourceResolver(parameters)) {

            // Get the Subject Resource associated with this Form
            final Resource subject = getSubjectResourceByUuid(serviceResolver, subjectUUID);
            if (subject == null) {
                return this;
            }

            // Get the type value for the Subject
            final String type = subject.getValueMap().get("type", "");
            // Get the Questionnaire Resource associated with this Form
            final Resource questionnaire = getQuestionnaireResourceByUuid(serviceResolver, questionnaireUUID);
            if (questionnaire == null) {
                return this;
            }

            // Get the requiredSubjectTypes value for the Questionnaire
            final String[] allRequiredSubjectTypes = questionnaire.getValueMap().get("requiredSubjectTypes",
                    String[].class);
            final List<String> allRequiredSubjectTypesList = Arrays.asList(allRequiredSubjectTypes != null
                    ? allRequiredSubjectTypes : new String[0]);
            if (!allRequiredSubjectTypesList.contains(type)) {
                throw new CommitFailedException(CommitFailedException.STATE, 400,
                    "The type is not listed by the associated Questionnaire’s requiredSubjectTypes property");
            }

        } catch (final LoginException e) {
            // Should not happen
        }
        return this;
    }

    /**
     * Obtains the Questionnaire Resource that has a specified jcr:uuid.
     *
     * @param ResourceResolver a ResourceResolver that can be used for querying the JCR
     * @param uuid the jcr:uuid of the Questionnaire Resource which we wish to obtain
     * @return the matching Questionnaire Resource or null if none can be found
     */
    private Resource getQuestionnaireResourceByUuid(final ResourceResolver serviceResolver, final String uuid)
    {
        final Iterator<Resource> resourceIterator = serviceResolver.findResources(
                "SELECT * FROM [cards:Questionnaire] AS q WHERE q.'jcr:uuid'='" + uuid + "'", "JCR-SQL2");

        if (!resourceIterator.hasNext()) {
            return null;
        }
        return resourceIterator.next();
    }

    /**
     * Obtains the Subject Resource that has a specified jcr:uuid.
     *
     * @param ResourceResolver a ResourceResolver that can be used for querying the JCR
     * @param uuid the jcr:uuid of the Subject Resource which we wish to obtain
     * @return the matching Subject Resource or null if none can be found
     */
    private Resource getSubjectResourceByUuid(final ResourceResolver serviceResolver, final String uuid)
    {
        final Iterator<Resource> resourceIterator = serviceResolver.findResources(
                "SELECT * FROM [cards:Subject] as s WHERE s.'jcr:uuid'='" + uuid + "'", "JCR-SQL2");
        if (!resourceIterator.hasNext()) {
            return null;
        }
        return resourceIterator.next();
    }

    @Override
    public Validator childNodeChanged(String s, NodeState before, NodeState after)
    {
        return this;
    }
}
