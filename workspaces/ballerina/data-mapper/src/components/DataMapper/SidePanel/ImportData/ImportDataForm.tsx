/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useMemo, useState } from "react";
import {
    Button,
    SidePanel,
    SidePanelTitleContainer,
    SidePanelBody,
    Codicon
} from "@wso2/ui-toolkit";
import { useRpcContext } from '@wso2/ballerina-rpc-client';

import { useDMIOConfigPanelStore } from "../../../../store/store";
import { ImportDataButtons } from "./ImportDataButtons";
import { ImportDataPanel } from "./ImportDataPanel";
import { ImportWSDLPanel, WSDLData } from "./ImportWSDLPanel";
import { useShallow } from "zustand/react/shallow";

export interface ImportType {
    type: string;
    label: string;
}

export enum FileExtension {
    JSON = ".json",
    XML = ".xml",
    CSV = ".csv",
    WSDL = ".wsdl"
}

export type ImportDataWizardProps = {
    configName: string;
};

export function ImportDataForm(props: ImportDataWizardProps) {
    const { configName } = props;
    const { rpcClient } = useRpcContext();

    const [selectedImportType, setSelectedImportType] = useState<ImportType>(undefined);

    const { isOpen, ioType, overwriteSchema, setSidePanelOpen } = useDMIOConfigPanelStore(
        useShallow(state => ({
            isOpen: state.isIOConfigPanelOpen,
            ioType: state.ioConfigPanelType,
            overwriteSchema: state.isSchemaOverridden,
            setSidePanelOpen: state.setIsIOConfigPanelOpen
        }))
    );

    const fileExtension = useMemo(() => {
        if (!selectedImportType) return undefined;

        switch (selectedImportType.type) {
            case 'JSON':
                return FileExtension.JSON;
            case 'CSV':
                return FileExtension.CSV;
            case 'XML':
                return FileExtension.XML;
            case 'JSONSCHEMA':
                return FileExtension.JSON;
            case 'WSDL':
                return FileExtension.WSDL;
        }
    }, [selectedImportType]);


    const loadSchema = async (content: string) => {
        try {
            // Get project path from visualizer location
            const location = await rpcClient.getVisualizerLocation();
            const documentUri = location.documentUri || "";

            const request = {
                documentUri: documentUri,
                overwriteSchema: overwriteSchema,
                resourceName: configName + '_' + ioType.toLowerCase() + 'Schema',
                content: content,
                ioType: ioType.toUpperCase(),
                schemaType: selectedImportType.type.toLowerCase(),
                configName: configName,
            }
            // await rpcClient.getMiDataMapperRpcClient().browseSchema(request).then(response => {
            //     setSidePanelOpen(false);
            //     if (response.success) {
            //         console.log("Schema imported successfully");
            //     } else {
            //         console.error("Error while importing schema");
            //     }
            // }).catch(e => {
            //     console.error("Error while importing schema", e);
            // });
        } catch (error) {
            console.error("Error getting visualizer location:", error);
        }
    };

    const loadWSDLSchema = async (data: WSDLData) => {
        try {
            // Get project path from visualizer location
            const location = await rpcClient.getVisualizerLocation();
            const projectPath = location.projectPath || "";

            if (!projectPath) {
                console.error("Project path is not available");
                return;
            }

            const wsdlRequest = {
                wsdlContent: data.wsdlContent,
                projectPath: projectPath,
                portName: data.portName
            };

            const response = await rpcClient.getLangClientRpcClient().generateTypesFromWSDL(wsdlRequest);

            if (response.error) {
                console.error("Error generating types from WSDL:", response.error);
            } else {
                console.log("Types generated successfully from WSDL");

                // Apply text edits if they exist
                if (response.textEdits && response.textEdits.changes) {
                    // Iterate through each file that has changes
                    for (const [fileUri, edits] of Object.entries(response.textEdits.changes)) {
                        // Convert file URI to file path
                        const filePath = fileUri.replace('file://', '');

                        try {
                            const editResult = await rpcClient.getCommonRpcClient().applyWorkspaceEdits({
                                edits: edits,
                                filePath: filePath
                            });

                            if (!editResult.success) {
                                console.error(`Failed to apply edits to ${filePath}:`, editResult.error);
                            }
                        } catch (error) {
                            console.error(`Error applying edits to ${filePath}:`, error);
                        }
                    }
                }

                setSidePanelOpen(false);
            }
        } catch (error) {
            console.error("Error calling WSDL service:", error);
        }
    };

    const handleFileUpload = (text: string) => {
        loadSchema(text);
    };

    const handleWSDLUpload = (data: WSDLData) => {
        loadWSDLSchema(data);
    };

    const onClose = () => {
        setSelectedImportType(undefined);
        setSidePanelOpen(false);
    };

    const handleImportTypeChange = (importType: ImportType) => {
        setSelectedImportType(importType);
    };

    return (
        <SidePanel
            isOpen={isOpen}
            alignment="right"
            width={312}
            overlay={false}
        >
            <SidePanelTitleContainer>
                {selectedImportType && (
                    <Codicon name="arrow-left"
                        sx={{ width: "20px"}}
                        onClick={() => setSelectedImportType(undefined)}
                    />
                )}
                <span>{`${overwriteSchema ? "Change" : "Import"} ${ioType} Schema`}</span>
                <Button
                    sx={{ marginLeft: "auto" }}
                    onClick={onClose}
                    appearance="icon"
                >
                    <Codicon name="close" />
                </Button>
            </SidePanelTitleContainer>
            <SidePanelBody>
                {!selectedImportType && <ImportDataButtons onImportTypeChange={handleImportTypeChange} />}
                {selectedImportType && selectedImportType.type === 'WSDL' && (
                    <ImportWSDLPanel
                        importType={selectedImportType}
                        extension={fileExtension}
                        rowRange={{ start: 15, offset: 10 }}
                        onSave={handleWSDLUpload}
                    />
                )}
                {selectedImportType && selectedImportType.type !== 'WSDL' && (
                    <ImportDataPanel
                        importType={selectedImportType}
                        extension={fileExtension}
                        rowRange={{ start: 15, offset: 10 }}
                        onSave={handleFileUpload}
                    />
                )}
            </SidePanelBody>
        </SidePanel>
    );
}
