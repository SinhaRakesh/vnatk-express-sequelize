const VNATKClientHelpers = require("../helperFunctions/clientside");
const _ = require('lodash');

module.exports = {

    replaceIncludeToObject(obj, Models) {
        if (typeof (obj) === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                if (key == 'model') {
                    // console.log(typeof models[value]);
                    obj.model = Models[value];
                }
                else {
                    if (typeof (value) === 'object')
                        module.exports.replaceIncludeToObject(value, Models);
                }
            }
        } else if (Array.isArray(obj)) {
            for (let index = 0; index < obj.length; index++) {
                const element = obj[index];
                module.exports.replaceIncludeToObject(element, Models);
            }
        }
    },

    senitizeModelOptions(options, model, Models) {
        if (_.has(options, 'attributes') && !options.attributes.includes(model.primaryKeyAttributes[0])) {
            options.attributes.push(model.primaryKeyAttributes[0]);
        }
        module.exports.replaceIncludeToObject(options, Models);
        return options;
    },



    getHeadersAndDeRef: function (model, req) {
        const associations = VNATKClientHelpers.getAssociations(model);
        var fields = undefined;
        if (req.body.retrive && req.body.retrive.modeloptions && req.body.retrive.modeloptions.attributes) fields = req.body.retrive.modeloptions.attributes;

        var fields_info = model.rawAttributes;
        if (!fields || fields == undefined || fields == null || fields == '' || fields == '*' || fields.length == 0) {
            fields = _.keys(fields_info);
        }

        var field_headers = [];

        for (let i = 0; i < fields.length; i++) {
            const fld = fields[i];
            const assosIndex = associations.findIndex(o => o.foreignKey == fields_info[fld].fieldName);
            if (req.body.retrive && req.body.retrive.autoderef && assosIndex > -1) {
                // ASSOCIATION found, belongsTo field
                field_headers.push({
                    text: associations[assosIndex].name.singular,
                    value: associations[assosIndex].name.singular + '.name', //TODO get titlefield from model
                    sortable: fields_info[fld].sortable ? fields_info[fld].sortable : true,
                })
                // TODO add in model include if not set
                if (!req.body.retrive.modeloptions.include) req.body.retrive.modeloptions.include = [];
                inArrayAsString = req.body.retrive.modeloptions.include.includes(associations[assosIndex].name.singular);
                inArrayAsObjectInclude = req.body.retrive.modeloptions.include.findIndex(o => o.model == associations[assosIndex].name.singular);
                if (!inArrayAsString && inArrayAsObjectInclude == -1) {
                    req.body.retrive.modeloptions.include.push(associations[assosIndex].name.singular);
                }

            } else {
                field_headers.push({
                    text: fields_info[fld].caption ? fields_info[fld].caption : fields_info[fld].fieldName,
                    value: fields_info[fld].fieldName,
                    sortable: fields_info[fld].sortable ? fields_info[fld].sortable : true,
                    primaryKey: fields_info[fld].primaryKey ? true : undefined,
                })
            }
        }

        return field_headers;
    },

    createNew: async function (model, data, readModelOptions) {
        const item = await model['create'](data).catch(error => {
            throw error;
        });
        var m_loaded = await model.unscoped().findByPk(item[model.primaryKeyAttributes[0]], readModelOptions);
        return m_loaded;
    },

    editRecord: async function (model, item, readModelOptions) {
        id = item[model.primaryKeyAttributes[0]];
        delete item[model.primaryKeyAttributes[0]];
        var where_condition = {};
        where_condition[model.primaryKeyAttributes[0]] = id;
        const updated = await model.update(item, { where: where_condition }).catch(error => {
            throw error;
        });
        var m_loaded = await model.unscoped().findByPk(id, readModelOptions);
        return m_loaded;
    },

    injectAddAction: function (model, req) {
        var addFields = undefined;
        if (req.body.create && req.body.create.modeloptions && req.body.create.modeloptions.attributes) addFields = req.body.create.modeloptions.attributes;
        var addAction = {
            name: 'vnatk_add',
            caption: 'Add',
            type: 'NoRecord',

            formschema: VNATKClientHelpers.generateFormSchemaFromModel(model, addFields)
        }
        return [addAction];
    },

    injectEditAction: function (model, req) {
        var editFields = undefined;
        if (req.body.update && req.body.update.modeloptions && req.body.update.modeloptions.attributes) editFields = req.body.update.modeloptions.attributes;
        var editAction = {
            name: 'vnatk_edit',
            caption: 'Edit',
            type: 'single',
            placeIn: 'buttonGroup',
            formschema: VNATKClientHelpers.generateFormSchemaFromModel(model, editFields)
        }
        return [editAction];
    },

    injectDeleteAction: function (model, req) {
        var deleteAction = {
            name: 'vnatk_delete',
            caption: 'Delete',
            type: 'single',
            placeIn: 'buttonGroup',
            formschema: {
                confirm: {
                    type: "checkbox",
                    label: "I am sure to delete this record.",
                    color: "red",
                    defaultValue: true
                }
            }
        }
        return [deleteAction];
    },

    injectActionColumn() {
        return {
            text: 'Actions',
            value: 'vnatk_actions',
            sortable: false
        };
    },

    getErrorCode(error) {
        if (error.name == 'SequelizeValidationError') {
            return 422;
        }
        return 500;
    }

}