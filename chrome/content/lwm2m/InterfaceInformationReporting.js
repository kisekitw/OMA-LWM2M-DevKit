/*******************************************************************************
 * Copyright (c) 2015, Institute for Pervasive Computing, ETH Zurich.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the Institute nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE INSTITUTE AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE INSTITUTE OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 * This file is part of the OMA LWM2M DevKit.
 *******************************************************************************/
/**
 * \file Main script file for the LWM2M DevKit.
 * 
 * \author Matthias Kovatsch <kovatsch@inf.ethz.ch>
 */

Lwm2mDevKit.InformationReporting = { };

Lwm2mDevKit.InformationReporting.entry = function(msg) {
	this.message = msg;
};

Lwm2mDevKit.InformationReporting.entry.prototype = {
	message : null,
	lastMID : -1,
	timer : null,
	number : 1,
	last : 0,
	lastValue : null
};

Lwm2mDevKit.InformationReporting.relations = { };

Lwm2mDevKit.InformationReporting.handleObserve = function(message) {
	
	let token = message.getToken();
	let path = message.getUriPath();
	let entry = Lwm2mDevKit.InformationReporting.relations[token];
	let operation = 'Notify';
	
	let pmax = Lwm2mDevKit.InformationReporting.getAttribute(path, 'pmax');
	
	if (entry) {
		if (entry.timer) window.clearTimeout(entry.timer);
	} else {
		Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Observe on '+ message.getUriPath());
		operation = 'Observe';
		entry = new Lwm2mDevKit.InformationReporting.entry(message);
		Lwm2mDevKit.InformationReporting.addRelationRow(message);
		
		if (message.reply.getContentFormat()==Lwm2mDevKit.Copper.CONTENT_TYPE_APPLICATION_VND_OMA_LWM2M_TEXT) {
			entry.lastValue = message.reply.getPayloadText();
		}
	}
	
	// enable pmin
	entry.last = Date.now();
	// enable pmax Notify
	entry.timer = window.setTimeout(
			function() {
				Lwm2mDevKit.InformationReporting.notify(path);
			}, pmax*1000);
	
	document.getElementById('reporting_relations_'+token).setAttribute('label', entry.number);
	message.reply.setObserve(entry.number++);
	Lwm2mDevKit.logOperationReporting(operation, path, "Success", message.reply);
	Lwm2mDevKit.InformationReporting.relations[token] = entry;
};

Lwm2mDevKit.InformationReporting.notify = function(path) {
	
	for (let token in Lwm2mDevKit.InformationReporting.relations) {
		let entry = Lwm2mDevKit.InformationReporting.relations[token];
		let opath = entry.message.getUriPath();
		
		// same path or shorter path (actually ending with EOF
		if (opath==path || ( path.startsWith(opath) && (path[opath.length]=='/' || path[opath.length]===undefined) )) {
		
			Lwm2mDevKit.logEvent("Notify for "+path+" triggering "+token+ " ("+opath+")");
			
			// notify is the last tutorial action
			Lwm2mDevKit.Tooltips.finish = true;
			Lwm2mDevKit.Tooltips.nextStep();
			
			let pmin = Lwm2mDevKit.InformationReporting.getAttribute(opath, 'pmin');
			let current = Date.now() - entry.last;
			
			if (current < pmin*1000) {
				
				if (entry.timer) window.clearTimeout(entry.timer);
				entry.timer = window.setTimeout(
						function() {
							Lwm2mDevKit.InformationReporting.notify(opath);
						}, pmin*1000 - current);
				Lwm2mDevKit.InformationReporting.relations[token] = entry;
				
				Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Postponing Notify for pmin='+ pmin);
				
			} else {
				
				Lwm2mDevKit.DeviceManagement.handleRead(entry.message);
				
				// conditional observe
				if (opath==path && entry.lastValue!==null) {
					
					let lt = Number( Lwm2mDevKit.InformationReporting.getAttribute(path, 'lt') );
					let gt = Number( Lwm2mDevKit.InformationReporting.getAttribute(path, 'gt') );
					let st = Number( Lwm2mDevKit.InformationReporting.getAttribute(path, 'st') );
					let pl = entry.message.reply.getPayloadText();
					
					if (lt && gt && (Number(pl)>lt || Number(pl)<gt)) {
						Lwm2mDevKit.logEvent('Dropping Notify for ' + path + ': value='+pl+', gt='+ gt+', lt='+lt);
						Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Dropping Notify for gt='+ gt + ' and lt='+ lt);
						return;
					} else if (lt && Number(pl)>lt) {
						Lwm2mDevKit.logEvent('Dropping Notify for ' + path + ': value='+pl+', lt='+lt);
						Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Dropping Notify for lt='+ lt);
						return;
					} else if (gt && Number(pl)<gt) {
						Lwm2mDevKit.logEvent('Dropping Notify for ' + path + ': value='+pl+', gt='+ gt);
						Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Dropping Notify for gt='+ gt);
						return;
					}
					if (st && Math.abs( Number(entry.lastValue) - Number(pl) ) < st) {
						Lwm2mDevKit.logEvent('Dropping Notify for ' + path + ': value='+pl+', last='+entry.lastValue+', step='+ st);
						Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Dropping Notify for st='+ st);
						return;
					}
					
					entry.lastValue = pl;
				}
				
				entry.lastMID = Lwm2mDevKit.coapEndpoint.nextMID();
				entry.message.reply.setType(Lwm2mDevKit.Copper.MSG_TYPE_CON);
				entry.message.reply.setMID(entry.lastMID);
				entry.message.reply.setCode(Lwm2mDevKit.Copper.CODE_2_05_CONTENT);
				Lwm2mDevKit.coapEndpoint.send(entry.message.reply, Lwm2mDevKit.observeHandler);
				
				let value = '';
				if (entry.message.reply.isPrintable()) value = ": " +  entry.message.reply.getPayloadText();
				Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Notify for '+ opath + value);
			}
		}
	}
};

Lwm2mDevKit.InformationReporting.cancel = function(cancel, message) {
	for (let token in Lwm2mDevKit.InformationReporting.relations) {
		if (token==cancel) {
			let entry = Lwm2mDevKit.InformationReporting.relations[token];
			window.clearTimeout( entry.timer );
			
			let rows = document.getElementById('reporting_relations');
			rows.removeChild( document.getElementById('reporting_relation_'+token) );
			
			delete Lwm2mDevKit.InformationReporting.relations[token];
			
			Lwm2mDevKit.logOperationReporting("Cancel", entry.message.getUriPath(), "Success", message);
			Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Cancel for '+ entry.message.getUriPath());
			return;
		}
	}
	Lwm2mDevKit.logWarning("Observe relation for token "+cancel+" not found");
};

Lwm2mDevKit.InformationReporting.cancelByMID = function(cancel, message) {
	for (let token in Lwm2mDevKit.InformationReporting.relations) {
		if (Lwm2mDevKit.InformationReporting.relations[token].lastMID==cancel) {
			let entry = Lwm2mDevKit.InformationReporting.relations[token];
			window.clearTimeout( entry.timer );
			
			let rows = document.getElementById('reporting_relations');
			rows.removeChild( document.getElementById('reporting_relation_'+token) );
			
			delete Lwm2mDevKit.InformationReporting.relations[token];
			
			Lwm2mDevKit.logOperationReporting("Cancel", entry.message.getUriPath(), "Success", message);
			Lwm2mDevKit.popup(Lwm2mDevKit.hostname+':'+Lwm2mDevKit.port, 'Cancel for '+ entry.message.getUriPath());
			return;
		}
	}
	Lwm2mDevKit.logWarning("Observe relation for MID "+cancel+" not found");
};

Lwm2mDevKit.InformationReporting.cancelManually = function(event) {
	
	if (event.key!='Del') return;
	
	let rows = document.getElementById('reporting_relations');
	if (!rows.selectedItem) return;
	Lwm2mDevKit.InformationReporting.cancel( rows.selectedItem.token );
};

Lwm2mDevKit.InformationReporting.cancelAll = function() {

	for (let token in Lwm2mDevKit.InformationReporting.relations) {
		let entry = Lwm2mDevKit.InformationReporting.relations[token];
		if (entry.timer) window.clearTimeout(entry.timer);

		let rows = document.getElementById('reporting_relations');
		rows.removeChild( document.getElementById('reporting_relation_'+token) );
		
		delete Lwm2mDevKit.InformationReporting.relations[token];
	}
};

Lwm2mDevKit.InformationReporting.getAttribute = function(path, attrib) {

	let temp = path.split('/');
	let obj = temp[0];
	let ins = temp[1];
	let res = temp[2];
	
	if (Lwm2mDevKit.client.attributes[obj]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][ins]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][ins][res]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][ins][res][attrib]!==undefined) {
		return Lwm2mDevKit.client.attributes[obj][ins][res][attrib];
	}
	if (Lwm2mDevKit.client.attributes[obj]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][ins]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][ins][attrib]!==undefined) {
		return Lwm2mDevKit.client.attributes[obj][ins][attrib];
	}
	if (Lwm2mDevKit.client.attributes[obj]!==undefined &&
		Lwm2mDevKit.client.attributes[obj][attrib]!==undefined) {
		return Lwm2mDevKit.client.attributes[obj][attrib];
	}
	
	if (attrib=='pmin') return Lwm2mDevKit.client.instances[1][1][2];
	if (attrib=='pmax') return Lwm2mDevKit.client.instances[1][1][3];
};

Lwm2mDevKit.InformationReporting.addRelationRow = function(message) {

	let rows = document.getElementById('reporting_relations');
	let token = message.getToken();
	
	var item = document.createElement('listitem');
	item.setAttribute('id', 'reporting_relation_'+token);
	item.token = token;

	var cell = document.createElement('listcell');
	cell.setAttribute('label', token);
	item.appendChild(cell);
	
	cell = document.createElement('listcell');
	cell.setAttribute('label', message.getUriPath());
	item.appendChild(cell);
	
	cell = document.createElement('listcell');
	cell.setAttribute('id', 'reporting_relations_'+token);
	cell.setAttribute('label', 1);
	item.appendChild(cell);

	rows.appendChild( item );
	
	//rows.ensureElementIsVisible(item);
};
