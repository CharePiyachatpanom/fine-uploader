/**
 * Defines the public API for FineUploader mode.
 */
qq.uiPublicApi = {
    clearStoredFiles: function() {
        this._parent.prototype.clearStoredFiles.apply(this, arguments);
        this._templating.clearFiles();
    },

    addExtraDropzone: function(element){
        this._dnd && this._dnd.setupExtraDropzone(element);
    },

    removeExtraDropzone: function(element){
        if (this._dnd) {
            return this._dnd.removeDropzone(element);
        }
    },

    getItemByFileId: function(id) {
        return this._templating.getFileContainer(id);
    },

    reset: function() {
        this._parent.prototype.reset.apply(this, arguments);
        this._templating.reset();

        if (!this._options.button && this._templating.getButton()) {
            this._defaultButtonId = this._createUploadButton({element: this._templating.getButton()}).getButtonId();
        }

        if (this._dnd) {
            this._dnd.dispose();
            this._dnd = this._setupDragAndDrop();
        }

        this._totalFilesInBatch = 0;
        this._filesInBatchAddedToUi = 0;

        this._setupClickAndEditEventHandlers();
    }
};




/**
 * Defines the private (internal) API for FineUploader mode.
 */
qq.uiPrivateApi = {
    _getButton: function(buttonId) {
        var button = this._parent.prototype._getButton.apply(this, arguments);

        if (!button) {
            if (buttonId === this._defaultButtonId) {
                button = this._templating.getButton();
            }
        }

        return button;
    },

    _removeFileItem: function(fileId) {
        this._templating.removeFile(fileId);
    },

    _setupClickAndEditEventHandlers: function() {
        this._deleteRetryOrCancelClickHandler = qq.DeleteRetryOrCancelClickHandler && this._bindDeleteRetryOrCancelClickEvent();

        // A better approach would be to check specifically for focusin event support by querying the DOM API,
        // but the DOMFocusIn event is not exposed as a property, so we have to resort to UA string sniffing.
        this._focusinEventSupported = !qq.firefox();

        if (this._isEditFilenameEnabled())
        {
            this._filenameClickHandler = this._bindFilenameClickEvent();
            this._filenameInputFocusInHandler = this._bindFilenameInputFocusInEvent();
            this._filenameInputFocusHandler = this._bindFilenameInputFocusEvent();
        }
    },

    _setupDragAndDrop: function() {
        var self = this,
            dropZoneElements = this._options.dragAndDrop.extraDropzones,
            templating = this._templating,
            defaultDropZone = templating.getDropZone();

        defaultDropZone && dropZoneElements.push(defaultDropZone);

        return new qq.DragAndDrop({
            dropZoneElements: dropZoneElements,
            allowMultipleItems: this._options.multiple,
            classes: {
                dropActive: this._options.classes.dropActive
            },
            callbacks: {
                processingDroppedFiles: function() {
                    templating.showDropProcessing();
                },
                processingDroppedFilesComplete: function(files) {
                    templating.hideDropProcessing();

                    if (files) {
                        self.addFiles(files);
                    }
                },
                dropError: function(code, errorData) {
                    self._itemError(code, errorData);
                },
                dropLog: function(message, level) {
                    self.log(message, level);
                }
            }
        });
    },

    _bindDeleteRetryOrCancelClickEvent: function() {
        var self = this;

        return new qq.DeleteRetryOrCancelClickHandler({
            templating: this._templating,
            log: function(message, lvl) {
                self.log(message, lvl);
            },
            onDeleteFile: function(fileId) {
                self.deleteFile(fileId);
            },
            onCancel: function(fileId) {
                self.cancel(fileId);
            },
            onRetry: function(fileId) {
                qq(self._templating.getFileContainer(fileId)).removeClass(self._classes.retryable);
                self.retry(fileId);
            },
            onGetName: function(fileId) {
                return self.getName(fileId);
            }
        });
    },

    _isEditFilenameEnabled: function() {
        return this._templating.isEditFilenamePossible()
            && !this._options.autoUpload
            && qq.FilenameClickHandler
            && qq.FilenameInputFocusHandler
            && qq.FilenameInputFocusHandler;
    },

    _filenameEditHandler: function() {
        var self = this,
            templating = this._templating;

        return {
            templating: templating,
            log: function(message, lvl) {
                self.log(message, lvl);
            },
            onGetUploadStatus: function(fileId) {
                return self.getUploads({id: fileId}).status;
            },
            onGetName: function(fileId) {
                return self.getName(fileId);
            },
            onSetName: function(id, newName) {
                var formattedFilename = self._options.formatFileName(newName);

                templating.updateFilename(id, formattedFilename);
                self.setName(id, newName);
            },
            onEditingStatusChange: function(id, isEditing) {
                var qqInput = qq(templating.getEditInput(id)),
                    qqFileContainer = qq(templating.getFileContainer(id));

                if (isEditing) {
                    qqInput.addClass('qq-editing');
                    templating.hideFilename(id);
                    templating.hideEditIcon(id);
                }
                else {
                    qqInput.removeClass('qq-editing');
                    templating.showFilename(id);
                    templating.showEditIcon(id);
                }

                // Force IE8 and older to repaint
                qqFileContainer.addClass('qq-temp').removeClass('qq-temp');
            }
        };
    },

    _onUploadStatusChange: function(id, oldStatus, newStatus) {
        if (this._isEditFilenameEnabled()) {
            // Status for a file exists before it has been added to the DOM, so we must be careful here.
            if (this._templating.getFileContainer(id) && newStatus !== qq.status.SUBMITTED) {
                this._templating.markFilenameEditable(id);
                this._templating.hideEditIcon(id);
            }
        }
    },

    _bindFilenameInputFocusInEvent: function() {
        var spec = qq.extend({}, this._filenameEditHandler());

        return new qq.FilenameInputFocusInHandler(spec);
    },

    _bindFilenameInputFocusEvent: function() {
        var spec = qq.extend({}, this._filenameEditHandler());

        return new qq.FilenameInputFocusHandler(spec);
    },

    _bindFilenameClickEvent: function() {
        var spec = qq.extend({}, this._filenameEditHandler());

        return new qq.FilenameClickHandler(spec);
    },

    _storeForLater: function(id) {
        this._parent.prototype._storeForLater.apply(this, arguments);
        this._templating.hideSpinner(id);
    },

    _onSubmit: function(id, name) {
        this._parent.prototype._onSubmit.apply(this, arguments);
        this._addToList(id, name);
    },

    // The file item has been added to the DOM.
    _onSubmitted: function(id) {
        // If the edit filename feature is enabled, mark the filename element as "editable" and the associated edit icon
        if (this._isEditFilenameEnabled()) {
            this._templating.markFilenameEditable(id);
            this._templating.showEditIcon(id);

            // If the focusin event is not supported, we must add a focus handler to the newly create edit filename text input
            if (!this._focusinEventSupported) {
                this._filenameInputFocusHandler.addHandler(this._templating.getEditInput(id));
            }
        }
    },

    // Update the progress bar & percentage as the file is uploaded
    _onProgress: function(id, name, loaded, total){
        this._parent.prototype._onProgress.apply(this, arguments);

        this._templating.updateProgress(id, loaded, total);

        if (loaded === total) {
            this._templating.hideCancel(id);

            this._templating.setStatusText(id, this._options.text.waitingForResponse);

            // If last byte was sent, display total file size
            this._displayFileSize(id);
        }
        else {
            // If still uploading, display percentage - total size is actually the total request(s) size
            this._displayFileSize(id, loaded, total);
        }
    },

    _onComplete: function(id, name, result, xhr) {
        var parentRetVal = this._parent.prototype._onComplete.apply(this, arguments),
            templating = this._templating,
            self = this;

        function completeUpload(result) {
            templating.setStatusText(id);

            qq(templating.getFileContainer(id)).removeClass(self._classes.retrying);
            templating.hideProgress(id);

            if (!self._options.disableCancelForFormUploads || qq.supportedFeatures.ajaxUploading) {
                templating.hideCancel(id);
            }
            templating.hideSpinner(id);

            if (result.success) {
                if (self._isDeletePossible()) {
                    templating.showDelete(id);
                }

                qq(templating.getFileContainer(id)).addClass(self._classes.success);

                self._maybeUpdateThumbnail(id);
            }
            else {
                qq(templating.getFileContainer(id)).addClass(self._classes.fail);

                if (self._templating.isRetryPossible() && !self._preventRetries[id]) {
                    qq(templating.getFileContainer(id)).addClass(self._classes.retryable);
                }
                self._controlFailureTextDisplay(id, result);
            }
        }

        // The parent may need to perform some async operation before we can accurately determine the status of the upload.
        if (qq.isPromise(parentRetVal)) {
            parentRetVal.done(function(newResult) {
                completeUpload(newResult);
            });

        }
        else {
            completeUpload(result);
        }

        return parentRetVal;
    },

    _onUpload: function(id, name){
        var parentRetVal = this._parent.prototype._onUpload.apply(this, arguments);

        this._templating.showSpinner(id);

        return parentRetVal;
    },

    _onCancel: function(id, name) {
        this._parent.prototype._onCancel.apply(this, arguments);
        this._removeFileItem(id);
    },

    _onBeforeAutoRetry: function(id) {
        var retryNumForDisplay, maxAuto, retryNote;

        this._parent.prototype._onBeforeAutoRetry.apply(this, arguments);

        this._showCancelLink(id);
        this._templating.hideProgress(id);

        if (this._options.retry.showAutoRetryNote) {
            retryNumForDisplay = this._autoRetries[id] + 1;
            maxAuto = this._options.retry.maxAutoAttempts;

            retryNote = this._options.retry.autoRetryNote.replace(/\{retryNum\}/g, retryNumForDisplay);
            retryNote = retryNote.replace(/\{maxAuto\}/g, maxAuto);

            this._templating.setStatusText(id, retryNote);
            qq(this._templating.getFileContainer(id)).addClass(this._classes.retrying);
        }
    },

    //return false if we should not attempt the requested retry
    _onBeforeManualRetry: function(id) {
        if (this._parent.prototype._onBeforeManualRetry.apply(this, arguments)) {
            this._templating.resetProgress(id);
            qq(this._templating.getFileContainer(id)).removeClass(this._classes.fail);
            this._templating.setStatusText(id);
            this._templating.showSpinner(id);
            this._showCancelLink(id);
            return true;
        }
        else {
            qq(this._templating.getFileContainer(id)).addClass(this._classes.retryable);
            return false;
        }
    },

    _onSubmitDelete: function(id) {
        var onSuccessCallback = qq.bind(this._onSubmitDeleteSuccess, this);

        this._parent.prototype._onSubmitDelete.call(this, id, onSuccessCallback);
    },

    _onSubmitDeleteSuccess: function(id, uuid, additionalMandatedParams) {
        if (this._options.deleteFile.forceConfirm) {
            this._showDeleteConfirm.apply(this, arguments);
        }
        else {
            this._sendDeleteRequest.apply(this, arguments);
        }
    },

    _onDeleteComplete: function(id, xhr, isError) {
        this._parent.prototype._onDeleteComplete.apply(this, arguments);

        this._templating.hideSpinner(id);

        if (isError) {
            this._templating.setStatusText(id, this._options.deleteFile.deletingFailedText);
            this._templating.showDelete(id);
        }
        else {
            this._removeFileItem(id);
        }
    },

    _sendDeleteRequest: function(id, uuid, additionalMandatedParams) {
        this._templating.hideDelete(id);
        this._templating.showSpinner(id);
        this._templating.setStatusText(id, this._options.deleteFile.deletingStatusText);
        this._deleteHandler.sendDelete.apply(this, arguments);
    },

    _showDeleteConfirm: function(id, uuid, mandatedParams) {
        var fileName = this._handler.getName(id),
            confirmMessage = this._options.deleteFile.confirmMessage.replace(/\{filename\}/g, fileName),
            uuid = this.getUuid(id),
            deleteRequestArgs = arguments,
            self = this,
            retVal;

        retVal = this._options.showConfirm(confirmMessage);

        if (qq.isPromise(retVal)) {
            retVal.then(function () {
                self._sendDeleteRequest.apply(self, deleteRequestArgs);
            });
        }
        else if (retVal !== false) {
            self._sendDeleteRequest.apply(self, deleteRequestArgs);
        }
    },

    _addToList: function(id, name) {
        var prependData,
            prependIndex = 0;

        if (this._options.disableCancelForFormUploads && !qq.supportedFeatures.ajaxUploading) {
            this._templating.disableCancel();
        }

        if (this._options.display.prependFiles) {
            if (this._totalFilesInBatch > 1 && this._filesInBatchAddedToUi > 0) {
                prependIndex = this._filesInBatchAddedToUi - 1;
            }

            prependData = {
                index: prependIndex
            }
        }

        if (!this._options.multiple) {
            this._handler.cancelAll();
            this._clearList();
        }

        this._templating.addFile(id, this._options.formatFileName(name), prependData);
        this._templating.generatePreview(id, this.getFile(id));

        this._filesInBatchAddedToUi += 1;

        if (this._options.display.fileSizeOnSubmit && qq.supportedFeatures.ajaxUploading) {
            this._displayFileSize(id);
        }
    },

    _clearList: function(){
        this._templating.clearFiles();
        this.clearStoredFiles();
    },

    _displayFileSize: function(id, loadedSize, totalSize) {
        var size = this.getSize(id),
            sizeForDisplay = this._formatSize(size);

        if (loadedSize !== undefined && totalSize !== undefined) {
            sizeForDisplay = this._formatProgress(loadedSize, totalSize);
        }

        this._templating.updateSize(id, sizeForDisplay);
    },

    _formatProgress: function (uploadedSize, totalSize) {
        var message = this._options.text.formatProgress;
        function r(name, replacement) { message = message.replace(name, replacement); }

        r('{percent}', Math.round(uploadedSize / totalSize * 100));
        r('{total_size}', this._formatSize(totalSize));
        return message;
    },

    _controlFailureTextDisplay: function(id, response) {
        var mode, maxChars, responseProperty, failureReason, shortFailureReason;

        mode = this._options.failedUploadTextDisplay.mode;
        maxChars = this._options.failedUploadTextDisplay.maxChars;
        responseProperty = this._options.failedUploadTextDisplay.responseProperty;

        if (mode === 'custom') {
            failureReason = response[responseProperty];
            if (failureReason) {
                if (failureReason.length > maxChars) {
                    shortFailureReason = failureReason.substring(0, maxChars) + '...';
                }
            }
            else {
                failureReason = this._options.text.failUpload;
                this.log("'" + responseProperty + "' is not a valid property on the server response.", 'warn');
            }

            this._templating.setStatusText(id, shortFailureReason || failureReason);

            if (this._options.failedUploadTextDisplay.enableTooltip) {
                this._showTooltip(id, failureReason);
            }
        }
        else if (mode === 'default') {
            this._templating.setStatusText(id, this._options.text.failUpload);
        }
        else if (mode !== 'none') {
            this.log("failedUploadTextDisplay.mode value of '" + mode + "' is not valid", 'warn');
        }
    },

    _showTooltip: function(id, text) {
        this._templating.getFileContainer(id).title = text;
    },

    _showCancelLink: function(id) {
        if (!this._options.disableCancelForFormUploads || qq.supportedFeatures.ajaxUploading) {
            this._templating.showCancel(id);
        }
    },

    _itemError: function(code, name, item) {
        var message = this._parent.prototype._itemError.apply(this, arguments);
        this._options.showMessage(message);
    },

    _batchError: function(message) {
        this._parent.prototype._batchError.apply(this, arguments);
        this._options.showMessage(message);
    },

    _setupPastePrompt: function() {
        var self = this;

        this._options.callbacks.onPasteReceived = function() {
            var message = self._options.paste.namePromptMessage,
                defaultVal = self._options.paste.defaultName;

            return self._options.showPrompt(message, defaultVal);
        };
    },

    _fileOrBlobRejected: function(id, name) {
        this._totalFilesInBatch -= 1;
        this._parent.prototype._fileOrBlobRejected.apply(this, arguments);
    },

    _prepareItemsForUpload: function(items, params, endpoint) {
        this._totalFilesInBatch = items.length;
        this._filesInBatchAddedToUi = 0;
        this._parent.prototype._prepareItemsForUpload.apply(this, arguments);
    },

    _maybeUpdateThumbnail: function(fileId) {
        var thumbnailUrl = this._thumbnailUrls[fileId];

        this._templating.updateThumbnail(fileId, thumbnailUrl);
    }
};
