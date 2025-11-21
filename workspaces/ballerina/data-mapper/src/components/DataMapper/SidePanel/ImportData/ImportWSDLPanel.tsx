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
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Button, Icon, LinkButton, TextArea, TextField } from "@wso2/ui-toolkit";
import { css } from "@emotion/css";
import styled from "@emotion/styled";
import { Controller, useForm } from 'react-hook-form';

import { FileExtension, ImportType } from "./ImportDataForm";
import { validateXML } from "./ImportDataUtils";

const ErrorMessage = styled.span`
   color: var(--vscode-errorForeground);
   font-size: 12px;
`;

const useStyles = () => ({
    fileUploadText: css({
        fontSize: "12px"
    }),
    formContainer: css({
        display: "flex",
        flexDirection: "column",
        gap: "16px"
    }),
    fieldContainer: css({
        display: "flex",
        flexDirection: "column",
        gap: "8px"
    })
});

interface RowRange {
    start: number;
    offset: number;
}

export interface WSDLData {
    wsdlContent: string;
    portName?: string;
}

interface ImportWSDLPanelProps {
    importType: ImportType;
    extension: FileExtension;
    rowRange?: RowRange;
    onSave: (data: WSDLData) => void;
}

export function ImportWSDLPanel(props: ImportWSDLPanelProps) {
    const { importType, extension, rowRange, onSave } = props;
    const classes = useStyles();
    const { clearErrors, control, formState: { errors }, setError, watch, setValue } = useForm({
        defaultValues: {
            wsdlContent: '',
            portName: ''
        }
    });

    const [rows, setRows] = useState(rowRange.start || 1);
    const [wsdlContent, setWsdlContent] = useState("");
    const [portName, setPortName] = useState("");
    const [availablePorts, setAvailablePorts] = useState<string[]>([]);

    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const hiddenFileInput = useRef(null);

    useEffect(() => {
        if (textAreaRef.current) {
            const textarea = textAreaRef.current.shadowRoot.querySelector("textarea");
            const handleOnKeyDown = (event: KeyboardEvent) => {
                if (event.key === "Tab") {
                    event.preventDefault();
                    const selectionStart = textarea.selectionStart;
                    textarea.setRangeText("  ", selectionStart, selectionStart, "end");
                }
            };

            textarea.addEventListener("keydown", handleOnKeyDown);
            return () => {
                textarea.removeEventListener("keydown", handleOnKeyDown);
            };
        }
    }, [textAreaRef]);

    useEffect(() => {
        if (!wsdlContent) return;
        
        try {
            // Validate WSDL content as XML
            validateXML(wsdlContent);
            
            // Extract port names from WSDL if it's a valid WSDL
            if (wsdlContent.includes('<wsdl:') || wsdlContent.includes('<definitions')) {
                extractPortNames(wsdlContent);
            }
            
            clearErrors("wsdlContent");
        } catch (error) {
            setError("wsdlContent", { message: `Invalid WSDL format: ${error.message}` });
        }
    }, [wsdlContent, clearErrors, setError]);

    const extractPortNames = (wsdlText: string) => {
        const portNames: string[] = [];
        try {
            // Parse WSDL to extract port names
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(wsdlText, "text/xml");
            
            // Look for port elements in different namespaces
            const portElements = xmlDoc.querySelectorAll('port, wsdl\\:port, soap\\:port');
            portElements.forEach(port => {
                const name = port.getAttribute('name');
                if (name && !portNames.includes(name)) {
                    portNames.push(name);
                }
            });

            // Also look for service ports
            const serviceElements = xmlDoc.querySelectorAll('service, wsdl\\:service');
            serviceElements.forEach(service => {
                const ports = service.querySelectorAll('port, wsdl\\:port');
                ports.forEach(port => {
                    const name = port.getAttribute('name');
                    if (name && !portNames.includes(name)) {
                        portNames.push(name);
                    }
                });
            });

            setAvailablePorts(portNames);
            
            // Auto-select first port if only one is available
            if (portNames.length === 1) {
                setPortName(portNames[0]);
                setValue('portName', portNames[0]);
            }
        } catch (error) {
            console.warn("Could not extract port names from WSDL:", error);
            setAvailablePorts([]);
        }
    };

    const growTextArea = (text: string) => {
        const { start, offset } = rowRange;
        const lineCount = text.split("\n").length;
        const newRows = Math.max(start, Math.min(start + offset, lineCount));
        setRows(newRows);
    };

    const handleWsdlContentChange = (e: any) => {
        if (rowRange) {
            growTextArea(e.target.value);
        }
        setWsdlContent(e.target.value);
        setValue('wsdlContent', e.target.value);
    };

    const handlePortNameChange = (e: any) => {
        setPortName(e.target.value);
        setValue('portName', e.target.value);
    };

    const handleClick = (event?: React.MouseEvent<HTMLButtonElement>) => {
        hiddenFileInput.current.click();
    };

    const showFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const reader = new FileReader();
        const ext = e.target.files[0].name.split(".").pop().toLowerCase();
        reader.readAsText(e.target.files[0]);
        reader.onload = async (loadEvent: any) => {
            if (`.${ext}` === extension) {
                const text = loadEvent.target.result as string;
                setWsdlContent(text);
                setValue('wsdlContent', text);
            }
        };
    };

    const handleSave = () => {
        const data: WSDLData = {
            wsdlContent,
            portName: portName || undefined
        };
        onSave(data);
    };

    const isFormValid = useMemo(() => {
        return wsdlContent.trim() !== '' && !errors.wsdlContent;
    }, [wsdlContent, errors.wsdlContent]);

    const fileUploadText = useMemo(() => `Upload WSDL file`, []);

    return (
        <div className={classes.formContainer}>
            <input 
                hidden={true} 
                accept={extension} 
                type="file" 
                onChange={showFile} 
                ref={hiddenFileInput} 
            />
            
            <LinkButton
                onClick={handleClick}
                sx={{ padding: "5px", gap: "2px", alignSelf: "flex-start" }}
            >
                <Icon
                    iconSx={{ fontSize: "12px" }}
                    name="file-upload"
                />
                <p className={classes.fileUploadText}>{fileUploadText}</p>
            </LinkButton>

            <div className={classes.fieldContainer}>
                <label htmlFor="wsdl-content">WSDL Content *</label>
                <Controller
                    name="wsdlContent"
                    control={control}
                    rules={{ required: "WSDL content is required" }}
                    render={({ field }) => (
                        <TextArea
                            ref={textAreaRef}
                            onChange={handleWsdlContentChange}
                            rows={rows}
                            resize="vertical"
                            placeholder="Paste WSDL content here or upload a WSDL file..."
                            value={wsdlContent}
                            errorMsg={errors?.wsdlContent?.message?.toString()}
                        />
                    )}
                />
            </div>

            {availablePorts.length > 0 && (
                <div className={classes.fieldContainer}>
                    <label htmlFor="port-name">Port Name</label>
                    <Controller
                        name="portName"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                onChange={handlePortNameChange}
                                placeholder="Select or enter port name (optional)"
                                value={portName}
                                list="port-options"
                            />
                        )}
                    />
                    <datalist id="port-options">
                        {availablePorts.map(port => (
                            <option key={port} value={port} />
                        ))}
                    </datalist>
                    {availablePorts.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>
                            Available ports: {availablePorts.join(", ")}
                        </div>
                    )}
                </div>
            )}

            <div style={{ textAlign: "right", marginTop: "10px" }}>
                <Button
                    appearance="primary"
                    onClick={handleSave}
                    disabled={!isFormValid}
                >
                    Generate Types
                </Button>
            </div>
        </div>
    );
}