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

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.temporal.ChronoUnit;
import java.util.Calendar;
import java.util.Map;

import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.uhndata.cards.clarity.importer.spi.ClarityDataProcessor;

/**
 * Clarity import processor that computes the {@code LENGTH_OF_STAY_DAYS} based on the admission and discharge dates, if
 * no value is already present in the query result.
 *
 * @version $Id$
 */
@Component
public class LengthOfStayMapper implements ClarityDataProcessor
{
    private static final Logger LOGGER = LoggerFactory.getLogger(LengthOfStayMapper.class);

    @Override
    public Map<String, String> processEntry(Map<String, String> input)
    {
        final String lengthStr = input.get("LENGTH_OF_STAY_DAYS");
        Long length = null;
        if (lengthStr != null && lengthStr.length() > 0) {
            try {
                length = Long.parseLong(lengthStr);
            } catch (Exception e) {
                // Do nothing
            }
        }

        if (length == null) {
            try {
                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                Calendar admission = Calendar.getInstance();
                Calendar discharge = Calendar.getInstance();
                admission.setTime(dateFormat.parse(input.getOrDefault("HOSP_ADMISSION_DTTM", "")));
                discharge.setTime(dateFormat.parse(input.getOrDefault("HOSP_DISCHARGE_DTTM", "")));

                length = ChronoUnit.DAYS.between(admission.toInstant(), discharge.toInstant());
                input.put("LENGTH_OF_STAY_DAYS", String.valueOf(length));

                LOGGER.warn("Updated visit {} length of stay", input.getOrDefault("PAT_ENC_CSN_ID", "Unknown"));
            } catch (ParseException | NullPointerException e) {
                // Do nothing, could not calculate a new length so leave empty
            }
        }
        return input;
    }

    @Override
    public int getPriority()
    {
        return 10;
    }
}
