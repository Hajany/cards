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
package ca.sickkids.ccm.lfs.serialize.internal;

import java.util.function.Function;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.json.JsonObjectBuilder;
import javax.json.JsonValue;

import org.apache.sling.api.resource.Resource;
import org.osgi.service.component.annotations.Component;

import ca.sickkids.ccm.lfs.serialize.spi.ResourceJsonProcessor;

/**
 * Identify a node by including {@code @path} and {@code @name} properties. The name of this processor is
 * {@code identify}.
 *
 * @version $Id$
 */
@Component(immediate = true)
public class IdentificationProcessor implements ResourceJsonProcessor
{
    @Override
    public String getName()
    {
        return "identify";
    }

    @Override
    public int getPriority()
    {
        return 10;
    }

    @Override
    public boolean isEnabledByDefault(Resource resource)
    {
        return true;
    }

    @Override
    public void leave(final Node node, final JsonObjectBuilder json,
        final Function<Node, JsonValue> serializeNode)
    {
        // Add a few properties identifying the resource
        try {
            json.add("@path", node.getPath());
            json.add("@name", node.getName());
            // TODO This should be done in a separate processor
            json.add("@referenced", node.getReferences().hasNext());
        } catch (RepositoryException e) {
            // Unlikely, and not critical, just make sure the serialization doesn't fail
        }
    }
}
