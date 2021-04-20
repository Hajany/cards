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

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.jcr.Node;

import org.apache.commons.io.FileUtils;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ca.sickkids.ccm.lfs.vocabularies.spi.RepositoryHandler;
import ca.sickkids.ccm.lfs.vocabularies.spi.SourceParser;
import ca.sickkids.ccm.lfs.vocabularies.spi.VocabularyDescription;
import ca.sickkids.ccm.lfs.vocabularies.spi.VocabularyIndexException;
import ca.sickkids.ccm.lfs.vocabularies.spi.VocabularyIndexer;
import ca.sickkids.ccm.lfs.vocabularies.spi.VocabularyParserUtils;
import ca.sickkids.ccm.lfs.vocabularies.spi.VocabularyTermSource;

/**
 * Generic indexer for vocabularies available on the <a href="http://data.bioontology.org/">BioOntology</a> portal.
 * BioOntology is a RESTfull server serving a large collection of vocabularies, available as OWL sources, along with
 * meta-information.
 * <p>
 * To be invoked, this indexer requires that:
 * <ul>
 * <li>the {@code source} request parameter is {@code bioontology}</li>
 * <li>the {@code identifier} request parameter is a valid, case-sensitive identifier of a vocabulary available in the
 * BioOntology server</li>
 * </ul>
 * An optional {@code version} parameter can be used to index a specific version of the target vocabulary. If not
 * specified, then the latest available version will be used.
 *
 * @version $Id$
 */
@Component(
    service = VocabularyIndexer.class,
    name = "VocabularyIndexer.bioontology")
public class BioOntologyIndexer implements VocabularyIndexer
{
    private static final Logger LOGGER = LoggerFactory.getLogger(BioOntologyIndexer.class);

    @Reference
    private VocabularyParserUtils utils;

    @Reference(target = "(component.name=RepositoryHandler.bioontology)")
    private RepositoryHandler repository;

    /**
     * Automatically injected list of all available parsers. A {@code volatile} list dynamically changes when
     * implementations are added, removed, or replaced.
     */
    @Reference
    private volatile List<SourceParser> parsers;

    /** The vocabulary node where the indexed data must be placed. */
    private InheritableThreadLocal<Node> vocabularyNode = new InheritableThreadLocal<>();

    /** The list which holds all JCR vocabulary nodes associated with a vocabulary to be checked-in. */
    private InheritableThreadLocal<ArrayList<Node>> nodesToCheckIn = new InheritableThreadLocal<>();

    @Override
    public boolean canIndex(String source)
    {
        return "bioontology".equals(source);
    }

    @Override
    public void index(final String source, final SlingHttpServletRequest request,
        final SlingHttpServletResponse response)
        throws IOException, VocabularyIndexException
    {
        // Obtain relevant request parameters.
        String identifier = request.getParameter("identifier");
        String version = request.getParameter("version");
        String overwrite = request.getParameter("overwrite");

        // Obtain the resource of the request and adapt it to a JCR node. This must be the /Vocabularies homepage node.
        Node homepage = request.getResource().adaptTo(Node.class);

        File temporaryFile = null;
        try {
            // Throw exceptions if mandatory parameters are not found or if homepage node cannot be found
            if (identifier == null) {
                throw new VocabularyIndexException("Mandatory [identifier] parameter not provided.");
            }

            if (homepage == null) {
                throw new VocabularyIndexException("Could not access resource of your request.");
            }

            // Delete the Vocabulary node already representing this vocabulary instance if it exists
            this.utils.clearVocabularyNode(homepage, identifier, overwrite);

            // Load the description
            VocabularyDescription description = this.repository.getVocabularyDescription(identifier, version);

            // Check that we have a known parser for this vocabulary
            SourceParser parser =
                this.parsers.stream().filter(p -> p.canParse(description.getSourceFormat())).findFirst()
                    .orElseThrow(() -> new VocabularyIndexException("No known parsers for vocabulary [" + identifier
                        + "] in format [" + description.getSourceFormat() + "]"));

            // Download the source
            temporaryFile = this.repository.downloadVocabularySource(description);

            // Keep track of the JCR Nodes that are to be checked in
            this.nodesToCheckIn.set(new ArrayList<Node>());

            // Create a new Vocabulary node representing this vocabulary
            this.vocabularyNode.set(OntologyIndexerUtils.createVocabularyNode(
                homepage, description, this.nodesToCheckIn));

            // Parse the source file and create VocabularyTerm node children
            parser.parse(temporaryFile, description, this::createVocabularyTermNode);

            /*
             * Save the JCR session. If any errors occur before this step, all proposed changes will not be applied and
             * the repository will remain in its original state. Lucene indexing is automatically performed by the
             * Jackrabbit Oak repository when this is performed.
             */
            OntologyIndexerUtils.saveSession(homepage);

            // Check-in the nodes
            OntologyIndexerUtils.checkInVocabulary(homepage, this.nodesToCheckIn);

            // Success response json
            this.utils.writeStatusJson(request, response, true, null);
        } catch (Exception e) {
            // If parsing fails, return an error json with the exception message
            this.utils.writeStatusJson(request, response, false, "Vocabulary indexing error: " + e.getMessage());
            LOGGER.error("Vocabulary indexing error: {}", e.getMessage(), e);
        } finally {
            // Delete temporary source file
            FileUtils.deleteQuietly(temporaryFile);
            this.vocabularyNode.remove();
        }
    }

    private void createVocabularyTermNode(VocabularyTermSource term)
    {
        OntologyIndexerUtils.createVocabularyTermNode(term, this.vocabularyNode, this.nodesToCheckIn);
    }
}
