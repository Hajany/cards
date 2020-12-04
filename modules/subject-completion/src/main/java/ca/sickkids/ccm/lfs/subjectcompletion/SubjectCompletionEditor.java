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
package ca.sickkids.ccm.lfs.subjectcompletion;

import java.util.ArrayList;
import java.util.List;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.jcr.Session;
import javax.jcr.Value;

import org.apache.jackrabbit.oak.api.CommitFailedException;
import org.apache.jackrabbit.oak.api.Type;
import org.apache.jackrabbit.oak.spi.commit.DefaultEditor;
import org.apache.jackrabbit.oak.spi.commit.Editor;
import org.apache.jackrabbit.oak.spi.state.NodeBuilder;
import org.apache.jackrabbit.oak.spi.state.NodeState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * An {@link Editor} that sets the fullIdentifier Subject property.
 *
 * @version $Id$
 */
public class SubjectCompletionEditor extends DefaultEditor
{
    private static final Logger LOGGER = LoggerFactory.getLogger(SubjectCompletionEditor.class);

    private static final String PROP_FULLID_NAME = "fullIdentifier";

    private static final String PROP_PARENTS = "parents";

    private final Session session;

    // This holds the builder for the current node. The methods called for editing specific properties don't receive the
    // actual parent node of those properties, so we must manually keep track of the current node.
    private final NodeBuilder currentNodeBuilder;

    private final NodeBuilder subject;

    // This holds a list of NodeBuilders with the first item corresponding to the root of the JCR tree
    // and the last item corresponding to the current node. By keeping this list, one is capable of
    // moving up the tree and setting status flags of ancestor nodes based on the status flags of a
    // descendant node.
    private final List<NodeBuilder> currentNodeBuilderPath;

    /**
     * Simple constructor.
     *
     * @param nodeBuilder a list of NodeBuilder objects starting from the root of the JCR tree and moving down towards
     *            the current node.
     * @param subject the subject node found up the tree, if any; may be {@code null} if no subject node has been
     *            encountered so  far
     * @param session the session used to retrieve subjects by UUID
     */
    public SubjectCompletionEditor(final List<NodeBuilder> nodeBuilder, final NodeBuilder subject,
        final Session session)
    {
        this.currentNodeBuilderPath = nodeBuilder;
        this.currentNodeBuilder = nodeBuilder.get(nodeBuilder.size() - 1);
        this.session = session;
        if (isSubject(this.currentNodeBuilder)) {
            this.subject = this.currentNodeBuilder;
        } else {
            this.subject = subject;
        }
    }

    // When something changes in a node deep in the content tree, the editor is invoked starting with the root node,
    // descending to the actually changed node through subsequent calls to childNodeChanged. The default behavior of
    // DefaultEditor is to stop at the root, so we must override the following two methods in order for the editor to be
    // invoked on non-root nodes.
    @Override
    public Editor childNodeAdded(final String name, final NodeState after)
        throws CommitFailedException
    {
        final List<NodeBuilder> tmpList = new ArrayList<>(this.currentNodeBuilderPath);
        tmpList.add(this.currentNodeBuilder.getChildNode(name));
        return new SubjectCompletionEditor(tmpList, this.subject, this.session);
    }

    @Override
    public void leave(NodeState before, NodeState after) throws CommitFailedException
    {
        if (isSubject(this.currentNodeBuilder)) {
            try {
                summarize();
            } catch (RepositoryException e) {
                // This is not a fatal error, the subject status is not required for a functional application
                LOGGER.warn("Unexpected exception while checking the completion status of subject {}",
                    this.currentNodeBuilder.getString("jcr:uuid"));
            }
        }
    }

    /**
     * Gather all identifiers from all the Subject parents of the current node and store them as the ' / ' separated
     * fullIdentifier property.
     *
     * @throws RepositoryException if accessing the repository fails
     */
    private void summarize() throws RepositoryException
    {
        final List<String> identifiers = new ArrayList<>();
        Node subjectNode = (Node) this.currentNodeBuilder;

        // Iterate through all parents of this node
        while (subjectNode != null) {
            identifiers.add(subjectNode.getProperty("identifier").getString());
            if (!subjectNode.hasProperty(PROP_PARENTS)) {
                break;
            }
            Value parent;
            if (subjectNode.getProperty(PROP_PARENTS).isMultiple()) {
                parent = subjectNode.getProperty(PROP_PARENTS).getValues()[0];
            } else {
                parent = subjectNode.getProperty(PROP_PARENTS).getValue();
            }
            subjectNode = this.session.getNodeByIdentifier(parent.getString());
        }

        // Write fullIdentifier to the JCR repo
        this.currentNodeBuilder.setProperty(PROP_FULLID_NAME,
            identifiers.stream().reduce((result, parent) -> parent + " / " + result).get(), Type.STRING);
    }

    /**
     * Checks if the given node is a Subject node.
     *
     * @param node the JCR Node to check
     * @return {@code true} if the node is a Subject node, {@code false} otherwise
     */
    private boolean isSubject(NodeBuilder node)
    {
        return "lfs:Subject".equals(getNodeType(node));
    }

    /**
     * Retrieves the primary node type of a node, as a String.
     *
     * @param node the node whose type to retrieve
     * @return a string
     */
    private String getNodeType(NodeBuilder node)
    {
        return node.getProperty("jcr:primaryType").getValue(Type.STRING);
    }
}
