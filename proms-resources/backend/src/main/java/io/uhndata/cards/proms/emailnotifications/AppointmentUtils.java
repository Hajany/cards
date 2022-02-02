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

package io.uhndata.cards.proms.emailnotifications;

import java.text.SimpleDateFormat;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Calendar;
import java.util.Iterator;

import org.apache.commons.validator.routines.EmailValidator;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class AppointmentUtils
{
    /** Default log. */
    private static final Logger LOGGER = LoggerFactory.getLogger(AppointmentUtils.class);

    // Hide the utility class constructor
    private AppointmentUtils()
    {
    }

    /**
     * Returns the JCR Resource with the given jcr:uuid or null if such
     * JCR Resource cannot be found.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param jcrUuid the jcr:uuid of the searched-for JCR Resource
     * @return the JCR resource with the given jcr:uuid or null
     */
    public static Resource getSubjectNode(ResourceResolver resolver, String jcrUuid)
    {
        Iterator<Resource> results;
        results = resolver.findResources(
            "SELECT * FROM [cards:Subject] as s WHERE s.'jcr:uuid'='" + jcrUuid + "'", "JCR-SQL2");
        if (results.hasNext()) {
            return results.next();
        } else {
            return null;
        }
    }

    /**
     * Returns the CARDS Subject typed JCR resource that is related to a
     * given Form resource. Returns null if no such match can be found.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param formResource the CARDS Form JCR Resource which the searched-for Subject relates to
     * @param subjectTypePath the Subject type of the searched-for Subject (eg. /SubjectTypes/Patient)
     * @return the matching CARDS Subject JCR Resource or null
     */
    public static Resource getRelatedSubjectOfType(ResourceResolver resolver, Resource formResource,
        String subjectTypePath)
    {
        final String subjectTypeUuid = resolver.getResource(subjectTypePath).getValueMap().get("jcr:uuid", "");
        final String[] relatedSubjects = formResource.getValueMap().get("relatedSubjects", String[].class);
        for (int i = 0; i < relatedSubjects.length; i++) {
            Resource tmpSubject = getSubjectNode(resolver, relatedSubjects[i]);
            if (tmpSubject == null) {
                continue;
            }
            if (subjectTypeUuid.equals(tmpSubject.getValueMap().get("type", ""))) {
                return tmpSubject;
            }
        }
        return null;
    }

    /**
     * Returns the first answer found for a given query of a CARDS Subject
     * and a JCR Path to a cards:Question node. Returns a default value if
     * no such match is found.
     *
     * @param <T> the Java type of the value to be returned (eg. String, long, etc...)
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param subject the CARDS Subject JCR Resource to search for an answer for
     * @param questionPath the question for which an answer is sought for
     * @param cardsDataType the CARDS data type of the expected answer (eg. cards:TextAnswer)
     * @param defaultValue the default value to return if the query can't find a match
     * @return the value of a Subject's response to a question or a default value
     */
    public static <T> T getQuestionAnswerForSubject(
        ResourceResolver resolver, Resource subject, String questionPath, String cardsDataType, T defaultValue)
    {
        final String subjectUUID = subject.getValueMap().get("jcr:uuid", "");
        final String questionUUID = resolver.getResource(questionPath).getValueMap().get("jcr:uuid", "");
        if ("".equals(questionUUID)) {
            return defaultValue;
        }
        Iterator<Resource> results;
        results = resolver.findResources(
            "SELECT t.* FROM [" + cardsDataType + "] as t INNER JOIN [cards:Form] AS f ON isdescendantnode(t, f)"
            + " WHERE t.'question'='" + questionUUID + "'"
            + " AND f.'subject'='" + subjectUUID + "'",
            "JCR-SQL2");
        if (results.hasNext()) {
            T answerVal = results.next().getValueMap().get("value", defaultValue);
            return answerVal;
        }
        return defaultValue;
    }

    /**
     * Returns the email address for the CARDS Patient Subject provided that
     * a valid email address has been provided and the patient has consented
     * to email communication. Otherwise, null is returned.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param patientSubject the JCR Resource for the patient whose email we wish to obtain
     * @return the patient's email address or null
     */
    public static String getPatientConsentedEmail(ResourceResolver resolver, Resource patientSubject)
    {
        long patientEmailOk = getQuestionAnswerForSubject(
            resolver,
            patientSubject,
            "/Questionnaires/Patient information/email_ok",
            "cards:BooleanAnswer",
            0
        );
        String patientEmailAddress = getQuestionAnswerForSubject(
            resolver,
            patientSubject,
            "/Questionnaires/Patient information/email",
            "cards:TextAnswer",
            ""
        );
        if (patientEmailOk == 1) {
            if (EmailValidator.getInstance().isValid(patientEmailAddress)) {
                return patientEmailAddress;
            }
        }
        return null;
    }

    /**
     * Returns a patient subject's full name (first + last).
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param patientSubject the JCR Resource for the patient whose full name we wish to obtain
     * @return the patient's first name + last name
     */
    public static String getPatientFullName(ResourceResolver resolver, Resource patientSubject)
    {
        String firstName = getQuestionAnswerForSubject(
            resolver,
            patientSubject,
            "/Questionnaires/Patient information/first_name",
            "cards:TextAnswer",
            ""
        );
        String lastName = getQuestionAnswerForSubject(
            resolver,
            patientSubject,
            "/Questionnaires/Patient information/last_name",
            "cards:TextAnswer",
            ""
        );
        return firstName + " " + lastName;
    }

    /**
     * Gets the clinic name associated with a Visit Subject Resource, or
     * null if the clinic name cannot be found.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param visitSubject the JCR Resource for the visit whose clinic name we wish to obtain
     * @return the clinic name associated with the Visit or null
     */
    public static String getVisitClinic(ResourceResolver resolver, Resource visitSubject)
    {
        String clinicId = getQuestionAnswerForSubject(
            resolver,
            visitSubject,
            "/Questionnaires/Visit information/surveys",
            "cards:TextAnswer",
            ""
        );
        if ("".equals(clinicId)) {
            return null;
        }
        return clinicId;
    }

    /**
     * Gets an email template for a given clinic.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param clinicId the clinic name whose email template we would like to obtain
     * @param templateName the name of the clinic's template to be obtained (eg. 72h.txt, 24h.txt, etc...)
     * @return the clinic email template or null if no template can be found
     */
    public static String getClinicEmailTemplate(ResourceResolver resolver, String clinicId, String templateName)
    {
        Resource mailTemplateResource = resolver.getResource(
            "/apps/cards/proms/clinics/"
            + clinicId
            + "/mailTemplates/"
            + templateName
            + "/jcr:content"
        );
        if (mailTemplateResource == null) {
            return null;
        }

        String htmlTemplate = mailTemplateResource.getValueMap().get("jcr:data", "");
        if ("".equals(htmlTemplate)) {
            return null;
        }
        return htmlTemplate;
    }

    /**
     * Gets an email template for a given visit.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param visitSubject the JCR Resource for the visit whose email template we wish to obtain
     * @param templateName the name of the visit's clinic's template to be obtained (eg. 72h.txt, 24h.txt, etc...)
     * @return the visit's clinic's email template or null if no template can be found
     */
    public static String getVisitEmailTemplate(ResourceResolver resolver, Resource visitSubject, String templateName)
    {
        String clinicId = getVisitClinic(resolver, visitSubject);
        if (clinicId == null) {
            return null;
        }
        String htmlTemplate = getClinicEmailTemplate(resolver, clinicId, templateName);
        return htmlTemplate;
    }

    /**
     * Returns the CARDS Form JCR Resource associated with a given CARDS
     * answer Resource or null if no match can be found.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param answerResource the CARDS answer to obtain the associated CARDS Form for
     * @return the Form JCR Resource for an answer JCR Resource or null
     */
    public static Resource getFormForAnswer(ResourceResolver resolver, Resource answerResource)
    {
        String answerPath = answerResource.getPath();
        String[] answerPathArray = answerPath.split("/");
        if (answerPathArray.length < 3) {
            return null;
        }
        if (!"".equals(answerPathArray[0])) {
            return null;
        }
        if (!"Forms".equals(answerPathArray[1])) {
            return null;
        }
        return resolver.getResource("/Forms/" + answerPathArray[2]);
    }

    /**
     * Parses a date string obtained from the JCR returns a
     * corresponding Java Calendar object. If parsing fails, null is
     * returned.
     *
     * @param str the JCR date string to parse
     * @return the Calendar object for the date string or null
     */
    public static Calendar parseDate(final String str)
    {
        try {
            final ZonedDateTime zdt = ZonedDateTime.parse(str);
            final Calendar calendar = Calendar.getInstance();
            calendar.setTimeInMillis(zdt.toInstant().toEpochMilli());
            return calendar;
        } catch (final DateTimeParseException e) {
            LOGGER.warn("PARSING DATE FAILED: Invalid date {}", str);
            return null;
        }
    }

    /**
     * Finds all appointments scheduled for a given day.
     *
     * @param resolver a ResourceResolver that can be used to query the JCR
     * @param dateToQuery the Java Calendar object for the day to query for appointments
     * @return an Iterator of cards:DateAnswer Resources representing the scheduled visits
     */
    public static Iterator<Resource> getAppointmentsForDay(ResourceResolver resolver, Calendar dateToQuery)
    {
        final SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
        final Resource visitTimeResult = resolver.getResource("/Questionnaires/Visit information/time");
        final String visitTimeUUID = visitTimeResult.getValueMap().get("jcr:uuid", "");
        final Calendar lowerBoundDate = (Calendar) dateToQuery.clone();
        lowerBoundDate.set(Calendar.HOUR_OF_DAY, 0);
        lowerBoundDate.set(Calendar.MINUTE, 0);
        lowerBoundDate.set(Calendar.SECOND, 0);
        lowerBoundDate.set(Calendar.MILLISECOND, 0);
        final Calendar upperBoundDate = (Calendar) lowerBoundDate.clone();
        upperBoundDate.add(Calendar.HOUR, 24);
        LOGGER.warn("Querying for appointments between {} and {}.",
            formatter.format(lowerBoundDate.getTime()),
            formatter.format(upperBoundDate.getTime()));

        final Iterator<Resource> results = resolver.findResources(
            "SELECT d.* FROM [cards:DateAnswer] AS d INNER JOIN [cards:Form] AS f ON"
            + " isdescendantnode(d, f) WHERE d.'question'='" + visitTimeUUID + "'"
            + " AND d.'value' >= cast('" + formatter.format(lowerBoundDate.getTime()) + "' AS date)"
            + " AND d.'value' < cast('" + formatter.format(upperBoundDate.getTime()) + "' AS date)",
            "JCR-SQL2"
        );
        return results;
    }
}
