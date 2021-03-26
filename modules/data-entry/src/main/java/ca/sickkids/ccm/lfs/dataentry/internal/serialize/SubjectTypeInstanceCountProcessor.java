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
package ca.sickkids.ccm.lfs.dataentry.internal.serialize;

import java.util.function.Function;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.RepositoryException;
import javax.jcr.query.Query;
import javax.json.JsonObjectBuilder;
import javax.json.JsonValue;

import org.apache.sling.api.resource.Resource;
import org.osgi.service.component.annotations.Component;

import ca.sickkids.ccm.lfs.serialize.spi.ResourceJsonProcessor;

/**
 * Adds number of corresponding subjects to the subject type json.
 * {@code simple}.
 *
 * @version $Id$
 */
@Component(immediate = true)
public class SubjectTypeInstanceCountProcessor implements ResourceJsonProcessor
{
    /** An original resource path. */
    private String originalPath;

    @Override
    public String getName()
    {
        return "instanceCount";
    }

    @Override
    public int getPriority()
    {
        return 55;
    }

    @Override
    public void start(Resource resource)
    {
        this.originalPath = resource.getPath();
    }

    @Override
    public boolean isEnabledByDefault(Resource resource)
    {
        return true;
    }

    @Override
    public boolean canProcess(Resource resource)
    {
        // This only processes subject types
        return resource.isResourceType("lfs/SubjectType");
    }

    @Override
    public void leave(Node node, JsonObjectBuilder json, Function<Node, JsonValue> serializeNode)
    {
        try {
            // Only the original subject type node will have its data appended
            if (!node.isNodeType("lfs:SubjectType") && !node.getPath().equals(this.originalPath)) {
                return;
            }
            Query queryObj = node.getSession().getWorkspace().getQueryManager().createQuery(generateDataQuery(node),
                "JCR-SQL2");
            NodeIterator nodeResult = queryObj.execute().getNodes();
            json.add("instanceCount", nodeResult.getSize());
        } catch (RepositoryException e) {
            // Really shouldn't happen
        }
    }

    private String generateDataQuery(final Node node)
        throws RepositoryException
    {
        String query = String.format("select n from [lfs:Subject] as n where n.type = '%s'",
            node.getProperty("jcr:uuid").getString());
        return query;
    }
}
