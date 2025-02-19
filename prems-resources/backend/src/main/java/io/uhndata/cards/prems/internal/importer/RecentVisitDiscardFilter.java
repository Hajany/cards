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

package io.uhndata.cards.prems.internal.importer;

import java.util.Calendar;
import java.util.Iterator;
import java.util.Map;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.PropertyIterator;
import javax.jcr.RepositoryException;

import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolver;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.Designate;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.uhndata.cards.clarity.importer.spi.ClarityDataProcessor;
import io.uhndata.cards.forms.api.FormUtils;
import io.uhndata.cards.forms.api.QuestionnaireUtils;
import io.uhndata.cards.resolverProvider.ThreadResourceResolverProvider;
import io.uhndata.cards.subjects.api.SubjectTypeUtils;
import io.uhndata.cards.subjects.api.SubjectUtils;

/**
 * Clarity import processor that discards visits for patients who have recently been sent surveys.
 *
 * @version $Id$
 */
@Component
@Designate(ocd = RecentVisitDiscardFilter.Config.class)
public class RecentVisitDiscardFilter implements ClarityDataProcessor
{
    private static final Logger LOGGER = LoggerFactory.getLogger(RecentVisitDiscardFilter.class);

    private final String subjectIDColumn;
    private final int minimumFrequency;

    @Reference
    private ThreadResourceResolverProvider rrp;

    @Reference
    private QuestionnaireUtils questionnaireUtils;

    @Reference
    private FormUtils formUtils;

    @Reference
    private SubjectUtils subjectUtils;

    @Reference
    private SubjectTypeUtils subjectTypeUtils;

    @ObjectClassDefinition(name = "Clarity import filter - Recent Visit Discarder",
        description = "Configuration for the Clarity importer filter that discards visits for patients who have had "
        + "surveys sent to them recently.")
    public @interface Config
    {
        @AttributeDefinition(name = "Minimum Frequency",
            description = "Minimum period in days between sending surveys to a patient")
        int minimum_visit_frequency();

        @AttributeDefinition(name = "Subject ID Column", description = "Clarity column containing the patient ID.")
        String subject_id_column();
    }

    @Activate
    public RecentVisitDiscardFilter(Config configuration)
    {
        this.subjectIDColumn = configuration.subject_id_column();
        this.minimumFrequency = configuration.minimum_visit_frequency();
    }

    @Override
    public Map<String, String> processEntry(Map<String, String> input)
    {
        final String mrn = input.get(this.subjectIDColumn);
        final String id = input.getOrDefault("PAT_ENC_CSN_ID", "Unknown");

        if (mrn == null || mrn.length() == 0) {
            LOGGER.warn("Discarded visit {} due to no mrn", id);
            return null;
        } else {
            // Get all patients with that MRN
            ResourceResolver resolver = this.rrp.getThreadResourceResolver();
            String subjectMatchQuery = String.format(
                "SELECT * FROM [cards:Subject] as subject WHERE subject.'identifier'='%s' option (index tag property)",
                mrn);
            resolver.refresh();
            final Iterator<Resource> subjectResourceIter = resolver.findResources(subjectMatchQuery, "JCR-SQL2");
            // Should only be 0 or 1 patient with that MRN. Process it if found.
            if (subjectResourceIter.hasNext() && subjectHasRecentSurveyEvent(subjectResourceIter.next(), id)) {
                return null;
            }
        }
        return input;
    }

    @Override
    public int getPriority()
    {
        return 10;
    }

    private boolean subjectHasRecentSurveyEvent(Resource subjectResource, String id)
    {
        final Node subjectNode = subjectResource.adaptTo(Node.class);
        try {
            // Iterate through all of the patients visits
            for (final NodeIterator visits = subjectNode.getNodes(); visits.hasNext();) {
                Node visit = visits.nextNode();
                if (isVisitSubject(visit)) {
                    // Iterate through all forms for that visit
                    for (final PropertyIterator forms = visit.getReferences("subject"); forms.hasNext();) {
                        final Node form = forms.nextProperty().getParent();
                        if (formIsRecentSurveyEvent(form)) {
                            // Discard the clarity row
                            LOGGER.warn("Discarded visit {} due to recent survey event", id);
                            return true;
                        }
                    }
                }
            }
        } catch (RepositoryException e) {
            // Failed to get forms for this subject: Could not check if any recent invitations have been sent.
            // Default to discarding this visit
            LOGGER.error("Discarded visit {}: Could not check for recent invitations", id);
            return true;
        }

        // No recent event was found
        return false;
    }

    private boolean isVisitSubject(final Node subject)
    {
        final String subjectType = this.subjectTypeUtils.getLabel(this.subjectUtils.getType(subject));
        return "Visit".equals(subjectType);
    }

    private boolean isSurveyEventsForm(final Node questionnaire)
    {
        try {
            return questionnaire != null && "/Questionnaires/Survey events".equals(questionnaire.getPath());
        } catch (final RepositoryException e) {
            LOGGER.warn("Failed check if form is Survey events form: {}", e.getMessage(), e);
            return false;
        }
    }

    private boolean formIsRecentSurveyEvent(Node form)
    {
        final Node questionnaire = this.formUtils.getQuestionnaire(form);
        if (isSurveyEventsForm(questionnaire)) {
            Node invitationSentQuestion =
                this.questionnaireUtils.getQuestion(questionnaire, "invitation_sent");

            final Calendar invitationSent =
                (Calendar) this.formUtils.getValue(
                this.formUtils.getAnswer(form, invitationSentQuestion));

            // If no value is set, survey is pending but has not yet been sent.
            // If that is the case or an invitation was sent recently, discard this visit.
            if (invitationSent == null || isRecent(invitationSent)) {
                return true;
            }
        }
        return false;
    }

    private boolean isRecent(Calendar date)
    {
        Calendar compareTo = Calendar.getInstance();
        compareTo.add(Calendar.DATE, -this.minimumFrequency);

        // Return true if the requested date is after the configured recent date.
        return date.after(compareTo);
    }
}
